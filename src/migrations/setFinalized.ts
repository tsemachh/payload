import { MigrateUpArgs } from '@payloadcms/db-mongodb'

/**
 * Recalculate and persist `finalized` on meetings.
 * Rule: finalized = (state === 'completed') AND all decision agenda items (not removed) have result !== '0'
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting setFinalized migration...')

  const { docs: meetings } = await payload.find({
    collection: 'meetings',
    select: { state: true, agenda: true, finalized: true },
    limit: 0,
    depth: 0,
  })

  let updatedTrue = 0
  let updatedFalse = 0
  let unchanged = 0

  for (const m of meetings as any[]) {
    const state = m?.state
    const agenda = Array.isArray(m?.agenda) ? m.agenda : []
    let shouldBeFinalized = false

    if (state === 'completed' && agenda.length > 0) {
      const decisionItems = agenda.filter(
        (item: any) => item?.topicType === 'decision' && !item?.isRemovedFromAgenda,
      )
      if (decisionItems.length > 0) {
        shouldBeFinalized = decisionItems.every((item: any) => item?.result && item.result !== '0')
      }
    }

    if (m.finalized === shouldBeFinalized) {
      unchanged++
      continue
    }

    await payload.update({
      collection: 'meetings',
      id: m.id,
      data: { finalized: shouldBeFinalized },
      req: { ...req, context: { ...req.context, from: 'migration', process: 'setFinalized' } },
    })

    if (shouldBeFinalized) updatedTrue++
    else updatedFalse++
  }

  console.log(
    `setFinalized summary: updated to true=${updatedTrue}, updated to false=${updatedFalse}, unchanged=${unchanged}, total=${meetings.length}`,
  )
}
