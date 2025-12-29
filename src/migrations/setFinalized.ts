import { MigrateUpArgs } from '@payloadcms/db-mongodb'

/**
 * Recalculate and persist `finalized` on meetings.
 * Rule: finalized = (state === 'completed') AND all decision agenda items (not removed) have result !== '0'
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting setFinalized migration (paged, concurrent updates)...')

  // Config knobs via env
  // Safer defaults to reduce pressure; all overridable via env
  const PAGE_SIZE = Number(process.env.MIG_PAGE_SIZE || 250)
  const CONCURRENCY = Math.max(1, Number(process.env.MIG_CONCURRENCY || 5))
  const FILTER_COMPLETED_ONLY = process.env.MIG_FILTER_COMPLETED_ONLY === '1' || true
  const UPDATE_TIMEOUT_MS = Math.max(1000, Number(process.env.MIG_UPDATE_TIMEOUT_MS || 30000))
  const BATCH_DELAY_MS = Math.max(0, Number(process.env.MIG_BATCH_DELAY_MS || 0))

  // Global counters
  let total = 0
  let updatedTrue = 0
  let updatedFalse = 0
  let unchanged = 0
  let failed = 0
  let processed = 0
  let timedOut = 0

  // Helper: compute finalized
  const computeShouldBeFinalized = (m: any): boolean => {
    const state = m?.state
    const agenda = Array.isArray(m?.agenda) ? m.agenda : []
    if (state === 'completed' && agenda.length > 0) {
      const decisionItems = agenda.filter(
        (item: any) => item?.topicType === 'decision' && !item?.isRemovedFromAgenda,
      )
      if (decisionItems.length > 0) {
        return decisionItems.every((item: any) => item?.result && item.result !== '0')
      }
    }
    return false
  }

  // Simple concurrency limiter without extra deps
  async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number) {
    const results: PromiseSettledResult<T>[] = []
    let i = 0
    const runNext = async (): Promise<void> => {
      const idx = i++
      if (idx >= tasks.length) return
      try {
        const val = await tasks[idx]()
        results[idx] = { status: 'fulfilled', value: val } as PromiseFulfilledResult<T>
      } catch (e: any) {
        results[idx] = { status: 'rejected', reason: e }
      }
      await runNext()
    }
    const starters = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext())
    await Promise.all(starters)
    return results
  }

  const where = FILTER_COMPLETED_ONLY
    ? { state: { equals: 'completed' }, finalized: { not_equals: true } }
    : undefined

  // Heartbeat to show liveness even if progress plateaued
  const heartbeat = setInterval(() => {
    console.log(
      `[setFinalized][heartbeat] processed=${processed}/${total} updatedTrue=${updatedTrue} updatedFalse=${updatedFalse} unchanged=${unchanged} failed=${failed} timedOut=${timedOut}`,
    )
  }, 60_000)

  // First request to know totals and totalPages
  const first = await payload.find({
    collection: 'meetings',
    select: { state: true, agenda: true, finalized: true },
    where,
    limit: PAGE_SIZE,
    page: 1,
    depth: 0,
    sort: '_id',
  })

  total = first.totalDocs ?? first.docs.length
  const totalPages =
    first.totalPages ?? (first.docs.length < PAGE_SIZE ? 1 : Math.ceil(total / PAGE_SIZE))

  console.log(
    `[setFinalized] Total meetings to scan: ${total} in ${totalPages} page(s); pageSize=${PAGE_SIZE}, concurrency=${CONCURRENCY}`,
  )

  const processPage = async (page: number) => {
    const res =
      page === 1
        ? first
        : await payload.find({
            collection: 'meetings',
            select: { state: true, agenda: true, finalized: true },
            where,
            limit: PAGE_SIZE,
            page,
            depth: 0,
            sort: '_id',
          })

    const docs = res.docs as any[]
    console.log(`[setFinalized] Page ${page}/${totalPages} start — ${docs.length} docs`)

    let pageUpdatedTrue = 0
    let pageUpdatedFalse = 0
    let pageUnchanged = 0
    let pageFailed = 0
    let pageTimedOut = 0

    // Build update tasks for changed docs only
    const tasks: Array<() => Promise<void>> = []

    for (const m of docs) {
      const shouldBeFinalized = computeShouldBeFinalized(m)
      if (m.finalized === shouldBeFinalized) {
        pageUnchanged++
        unchanged++
        processed++
        if (processed % 100 === 0) {
          console.log(
            `setFinalized progress: ${processed}/${total} (${Math.round(
              (processed / Math.max(total, 1)) * 100,
            )}%) — updatedTrue=${updatedTrue}, updatedFalse=${updatedFalse}, unchanged=${unchanged}, failed=${failed}`,
          )
        }
        continue
      }

      tasks.push(async () => {
        // per-doc retry up to 2 times
        let attempt = 0
        const startTs = Date.now()
        while (true) {
          try {
            // Watchdog: time out a single update and continue
            await Promise.race([
              payload.update({
                collection: 'meetings',
                id: m.id,
                data: { finalized: shouldBeFinalized },
                depth: 0,
                overrideAccess: true,
                req: {
                  // Do not spread the incoming req to avoid web-request leakage
                  context: { from: 'migration', process: 'setFinalized', skipSideEffects: true },
                } as any,
              }),
              new Promise((_, rej) =>
                setTimeout(() => rej(new Error('Update timed out')), UPDATE_TIMEOUT_MS),
              ),
            ])
            if (shouldBeFinalized) {
              pageUpdatedTrue++
              updatedTrue++
            } else {
              pageUpdatedFalse++
              updatedFalse++
            }
            break
          } catch (err) {
            attempt++
            const elapsed = Date.now() - startTs
            if ((err as Error)?.message === 'Update timed out') {
              pageTimedOut++
              timedOut++
            }
            if (attempt >= 3 || (err as Error)?.message === 'Update timed out') {
              pageFailed++
              failed++
              // log brief error
              console.warn(`[setFinalized] Update failed for meeting ${m.id} after ${attempt} attempts (elapsed=${elapsed}ms)`, err)
              break
            }
            // backoff
            await new Promise((r) => setTimeout(r, attempt * 150))
            continue
          }
        }
        processed++
        if (processed % 100 === 0) {
          console.log(
            `setFinalized progress: ${processed}/${total} (${Math.round(
              (processed / Math.max(total, 1)) * 100,
            )}%) — updatedTrue=${updatedTrue}, updatedFalse=${updatedFalse}, unchanged=${unchanged}, failed=${failed}, timedOut=${timedOut}`,
          )
        }
      })
    }

    // Run updates with concurrency cap
    if (tasks.length > 0) {
      await runWithConcurrency(tasks, CONCURRENCY)
    }

    console.log(
      `[setFinalized] Page ${page}/${totalPages} done — updatedTrue=${pageUpdatedTrue}, updatedFalse=${pageUpdatedFalse}, unchanged=${pageUnchanged}, failed=${pageFailed}, timedOut=${pageTimedOut}`,
    )

    if (BATCH_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  // Process pages sequentially to keep memory low and ensure stable progress
  for (let page = 1; page <= totalPages; page++) {
    await processPage(page)
  }

  // Clear heartbeat
  clearInterval(heartbeat)

  console.log(
    `setFinalized summary: updated to true=${updatedTrue}, updated to false=${updatedFalse}, unchanged=${unchanged}, failed=${failed}, timedOut=${timedOut}, total=${total}`,
  )
}
