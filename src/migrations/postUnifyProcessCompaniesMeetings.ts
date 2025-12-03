import { updateCompaniesMeetingsOnMeetingChange } from '@/collections/meetings/hooks/updateCompaniesMeetings'
import { MigrateUpArgs } from '@payloadcms/db-mongodb'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting post-unify enrichment for meetings with no holdings...')

  try {
    // Find meetings with no fundsWithHolding (missing or empty)
    const result = await payload.find({
      collection: 'meetings',
      select: {
        fullName: true,
      },
      where: {
        or: [{ fundsWithHolding: { exists: false } }, { 'fundsWithHolding.id': { exists: false } }],
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

    // Connect dual meetings
    console.log('Starting dual meeting connection...')

    // Find all main meetings that have dual stock
    const mainMeetingsResult = await payload.find({
      collection: 'meetings',
      where: {
        hasDualStock: {
          equals: true,
        },
      },
      limit: 0,
      depth: 1,
    })

    console.log(`Found ${mainMeetingsResult.docs.length} main meetings with dual stock to process.`)

    let connectedCount = 0

    for (const mainMeeting of mainMeetingsResult.docs) {
      try {
        // Get the dual stock ID from the main meeting's stock
        const dualStockId =
          typeof mainMeeting.stock === 'object' && mainMeeting.stock !== null
            ? mainMeeting.stock.dualStock
            : null

        if (!dualStockId) {
          console.log(`Main meeting ${mainMeeting.id} has no dual stock reference, skipping.`)
          continue
        }

        const mainMeetingDate = new Date(mainMeeting.meetingDate)
        // Zero out seconds and milliseconds for comparison
        mainMeetingDate.setSeconds(0, 0)

        // Find meetings with the dual stock and matching date
        const dualMeetingsResult = await payload.find({
          collection: 'meetings',
          where: {
            and: [
              {
                stock: {
                  equals: dualStockId,
                },
              },
              {
                meetingDate: {
                  exists: true,
                },
              },
            ],
          },
          select: {
            meetingDate: true,
            mainMeetingForDualMeeting: true,
          },
          limit: 0,
          depth: 0,
        })

        // Find the dual meeting with matching date (ignoring seconds)
        const dualMeeting = dualMeetingsResult.docs.find((meeting: any) => {
          const meetingDate = new Date(meeting.meetingDate)
          meetingDate.setSeconds(0, 0)
          return meetingDate.getTime() === mainMeetingDate.getTime()
        })

        if (dualMeeting) {
          const willConnect = !mainMeeting.dualMeeting || !dualMeeting.mainMeetingForDualMeeting
          if (!mainMeeting.dualMeeting) {
            // Update the main meeting with the dual meeting reference
            await payload.update({
              collection: 'meetings',
              id: mainMeeting.id,
              data: {
                dualMeeting: dualMeeting.id,
              },
              context: { from: 'migration' },
            })
          }
          if (!dualMeeting.mainMeetingForDualMeeting) {
            // Update the dual meeting with the main meeting reference
            await payload.update({
              collection: 'meetings',
              id: dualMeeting.id,
              data: {
                mainMeetingForDualMeeting: mainMeeting.id,
              },
              context: { from: 'migration' },
            })
          }
          if (willConnect) {
            connectedCount++
            console.log(
              `Connected main meeting ${mainMeeting.id} with dual meeting ${dualMeeting.id}`,
            )
          }
        } else if (mainMeetingDate.getTime() >= new Date().getTime()) {
          //create dual meeting
          const dualMeeting = JSON.parse(JSON.stringify(mainMeeting))
          delete dualMeeting.id
          delete dualMeeting.meetingId
          delete dualMeeting.dualMeeting
          delete dualMeeting.votes
          delete dualMeeting.votesCount
          delete dualMeeting.VotesStatus
          delete dualMeeting.reportVotesCount
          delete dualMeeting.votesReportStatus
          delete dualMeeting.companies
          delete dualMeeting.funds
          delete dualMeeting.fundsWithHolding
          delete dualMeeting.exceptionalRecommendation
          const genericResearchDocs = mainMeeting.researchDocuments?.filter((doc: any) => {
            return !doc.companies || doc.companies.length === 0
          })
          dualMeeting.researchDocuments = genericResearchDocs
          dualMeeting.stock = dualStockId
          dualMeeting._status = 'published'
          dualMeeting.mainMeetingForDualMeeting = mainMeeting.id

          try {
            const createdDualMeeting = await req.payload.create({
              collection: 'meetings',
              data: dualMeeting,
              context: { from: 'process' },
              req,
            })

            // Process both the dual meeting and the original meeting
            await updateCompaniesMeetingsOnMeetingChange(req, createdDualMeeting)
            const changeDate = new Date().toISOString()
            const changeSource = req.context?.from || 'user'
            // Only update the original meeting with the relation
            await req.payload.update({
              collection: 'meetings',
              id: mainMeeting.id,
              data: {
                dualMeeting: createdDualMeeting.id,
                migrationComments: `${changeDate} - [${changeSource}] Created dual meeting for stock ${dualStockId}`,
              },
              context: { from: 'process' },
              req,
            })
          } catch (error) {
            console.error('Error creating dual meeting:', error)
          }
        }
      } catch (error) {
        console.error(`Error connecting main meeting ${mainMeeting.id}:`, error)
      }
    }

    console.log(`Completed dual meeting connection. Connected ${connectedCount} pairs.`)
  } catch (e) {
    console.error('Failed during post-unify enrichment step:', e)
    throw e
  }
}
