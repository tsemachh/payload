import { MigrateUpArgs } from '@payloadcms/db-mongodb'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting post-unify enrichment for meetings with no holdings...')

  try {
    // Find meetings with no fundsWithHolding (missing or empty)
    const result = await payload.find({
      collection: 'meetings',
      where: {
        or: [
          { fundsWithHolding: { exists: false } },
          { 'fundsWithHolding.0': { exists: false } },
        ],
      },
      limit: 0,
      depth: 0,
    })

    const meetingIds: string[] = (result.docs || []).map((m: any) => m.id)
    console.log(`Found ${meetingIds.length} meetings with no holdings to enrich post-unify.`)

    if (meetingIds.length === 0) {
      console.log('No meetings require post-unify enrichment. Done.')
      return
    }

    // Lazy import to avoid circular deps at module load time
    const { processCompaniesMeetings } = await import(
      '@/collections/meetings/hooks/processCompaniesMeetings'
    )

    await processCompaniesMeetings(req as any, meetingIds)
    console.log('Completed post-unify enrichment for meetings with no holdings.')
  } catch (e) {
    console.error('Failed during post-unify enrichment step:', e)
    throw e
  }
}
