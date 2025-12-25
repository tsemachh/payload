import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { recalculateMeetingVoteCounts } from '@/collections/meetings/hooks/votesCountHooks'

type RecalcResponse = {
  success: boolean
  processed: number
  updated: number
  skipped: number
  errors: number
  messages: string[]
}

const RecalculateVoteCountsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    // Check auth
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }
    if (!req.user.isAdmin) {
      return Response.json({ error: 'Unauthorized: only admin is authorized' }, { status: 401 })
    }

    // @ts-expect-error req not null
    const data = await req.json()
    const meetings = data.selectedIds

    const resp: RecalcResponse = {
      success: true,
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      messages: [],
    }

    // Lightweight retry helper to handle transient driver disconnects during long loops in dev
    const withMongoRetry = async <T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> => {
      let lastErr: any
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn()
        } catch (e: any) {
          const msg = e?.message || ''
          // Retry only when the driver reports a transient not-connected state
          if (
            e?.name === 'MongoNotConnectedError' ||
            msg.includes('MongoNotConnectedError') ||
            msg.includes('Client must be connected')
          ) {
            lastErr = e
            // small backoff
            await new Promise((r) => setTimeout(r, 150 * attempt))
            continue
          }
          throw e
        }
      }
      throw lastErr
    }

    for (const m of meetings) {
      try {
        resp.processed++
        const result = await withMongoRetry(() => recalculateMeetingVoteCounts(req, m))
        if (result?.message?.startsWith('No Changes')) {
          resp.skipped++
        } else {
          resp.updated++
        }
        if (result?.message) resp.messages.push(result.message)
      } catch (e: any) {
        resp.errors++
        req.payload.logger.error({ error: e }, 'Failed to recalc votes for meeting ' + m)
        resp.messages.push(`Error for ${m}: ${e?.message || 'unknown error'}`)
      }
    }

    return Response.json(resp)
  } catch (error) {
    req.payload.logger.error(
      { error },
      `Error in RecalculateVoteCountsEndpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    return Response.json(
      {
        success: false,
        error: 'Failed to recalculate vote counts',
        details: (error as any)?.message,
      },
      { status: 500 },
    )
  }
}

export default RecalculateVoteCountsEndpoint
