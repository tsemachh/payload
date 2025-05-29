import { PayloadRequest } from 'payload'
import { createAdminNotification } from '@/utils/utils'
import { getWorkingDateBefore, getWorkingDateAfter } from '@/collections/meetings/hooks/ calculateHoldingDate'
import { Vote } from '@/payload-types'

/**
 * Endpoint to check for various conditions and create notifications
 * 1. Companies not feeding holdings for more than 2 working days
 * 2. Companies not voting on meetings happening in the next working day
 * 3. No feed from Predictae (stocks or meetings) in the past working day
 */
const CheckNotificationsEndpoint = async (req: PayloadRequest) => {
  try {
    // Authentication check
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    const notifications = {
      holdingsNotFed: 0,
      meetingsNotVoted: 0,
      noFeedFromPredictae: false,
    }

    // 1. Check companies not feeding holdings for more than 5 days
    await checkHoldingsFeeds(req, notifications)

    // 2. Check companies not voting on meetings happening in 1 day
    await checkMeetingVotes(req, notifications)

    // 3. Check if there was no feed from Predictae in the past day
    await checkPredictaeFeeds(req, notifications)

    return Response.json({
      success: true,
      notifications,
    })
  } catch (error) {
    req.payload.logger.error(`Error checking notifications: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to check notifications',
        details: error,
      },
      { status: 500 },
    )
  }
}

/**
 * Check companies not feeding holdings for more than 2 working days
 */
async function checkHoldingsFeeds(req: PayloadRequest, notifications: any) {
  try {
    // Get current date
    const now = new Date()

    // Number of working days to check (configurable)
    const workingDaysToCheck = 5

    // Calculate date for working days ago using getWorkingDateBefore
    const workingDaysAgo = getWorkingDateBefore(now, workingDaysToCheck, 12)
    const workingDaysAgoISO = workingDaysAgo.toISOString()

    // Find all companies
    const { docs: companies } = await req.payload.find({
      collection: 'companies',
      select:{
        name:true
      },
      where:{
        subCompanies:{
          exists: false
        }
      },
      limit: 0,
      depth: 0
    })

    // For each company, check if they have holdings after twoDaysAgo
    for (const company of companies) {
      // Find the latest holding feed for this company
      const { docs: holdingsFeeds } = await req.payload.find({
        collection: 'holdings-feed',
        where: {
          selectedCompanies: {
            contains: company.id,
          },
          valueDate: {
            greater_than_equal: workingDaysAgoISO,
          },
        },
        sort: '-valueDate',
        limit: 1,
      })

      // If no holdings feed found, create a notification
      if (holdingsFeeds.length === 0) {
        await createAdminNotification(
          req.payload,
          `חברה ${company.name} לא דיווחה על אחזקות במשך יותר מ-${workingDaysToCheck} ימי עבודה`,
          `/admin/collections/companies/${company.id}`,
          company.id,
        )
        notifications.holdingsNotFed++
      }
    }
  } catch (error) {
    req.payload.logger.error(`Error checking holdings feeds: ${JSON.stringify(error)}`)
  }
}

/**
 * Check companies not voting on meetings happening in the next working day
 */
async function checkMeetingVotes(req: PayloadRequest, notifications: any) {
  try {
    // Get current date
    const now = new Date()

    // Number of working days ahead to check (configurable)
    const workingDaysAhead = 1

    // Calculate next working day using getWorkingDateAfter
    const nextWorkingDay = getWorkingDateAfter(now, workingDaysAhead, 0)
    const nextWorkingDayStart = new Date(nextWorkingDay)
    nextWorkingDayStart.setHours(0, 0, 0, 0)
    const nextWorkingDayEnd = new Date(nextWorkingDay)
    nextWorkingDayEnd.setHours(23, 59, 59, 999)

    // Find meetings happening on the next working day
    const { docs: nextDayMeetings } = await req.payload.find({
      collection: 'meetings',
      select:{
        companies: true,
        fullName: true
      },
      where: {
        meetingDate: {
          greater_than_equal: nextWorkingDayStart.toISOString(),
          less_than_equal: nextWorkingDayEnd.toISOString(),
        },
      },
      limit: 0,
      depth: 0
    })

    // For each meeting, check which companies should vote but haven't
    for (const meeting of nextDayMeetings) {
      // Get companies related to this meeting
      if (
        !meeting.companies ||
        !Array.isArray(meeting.companies) ||
        meeting.companies.length === 0
      ) {
        continue
      }

      const meetingCompanyIds = meeting.companies as string[]

      // Find votes for this meeting
      const { docs: votes } = await req.payload.find({
        collection: 'votes',
        select:{
          companies: true
        },
        where: {
          meeting: {
            equals: meeting.id,
          },
          _status: {
            equals: 'published',
          },
        },
        limit: 0,
        depth : 0
      })

      // Get companies that have voted
      const votedCompanyIds = new Set()
      votes.forEach((vote:Partial<Vote>) => {
        if (vote.companies && Array.isArray(vote.companies)) {
          votedCompanyIds.add(vote.companies as string[])
        }
      })

      // Find companies that should vote but haven't
      const notVotedCompanyIds = meetingCompanyIds.filter((id) => !votedCompanyIds.has(id))

      // Create notifications for companies that haven't voted
      for (const companyId of notVotedCompanyIds) {
        // Get company details
        const company = await req.payload.findByID({
          collection: 'companies',
          select:{
            name: true
          },
          id: companyId,
        })

        await createAdminNotification(
          req.payload,
          `חברה ${company.name || companyId} לא הצביעה באסיפה שתתקיים ביום העבודה הבא: ${meeting.fullName}`,
          `/admin/collections/meetings/${meeting.id}`,
          companyId,
        )
        notifications.meetingsNotVoted++
      }
    }
  } catch (error) {
    req.payload.logger.error(`Error checking meeting votes: ${JSON.stringify(error)}`)
  }
}

/**
 * Check if there was no feed from Predictae in the past working day
 */
async function checkPredictaeFeeds(req: PayloadRequest, notifications: any) {
  try {
    // Get current date
    const now = new Date()

    // Number of working days to check (configurable)
    const workingDaysToCheck = 1

    // Calculate date for working days ago using getWorkingDateBefore
    const oneDayAgo = getWorkingDateBefore(now, workingDaysToCheck, 12)
    const oneDayAgoISO = oneDayAgo.toISOString()

    // Check for any feed in the past working day
    // Since we don't have specific information about Predictae feeds,
    // we'll check all feed collections

    // Check stocks feed
    const { docs: stocksFeeds } = await req.payload.find({
      collection: 'stocks-feed',
      where: {
        createdAt: {
          greater_than_equal: oneDayAgoISO,
        },
      },
      limit: 1,
      depth: 0
    })


    // Check meetings feed
    const { docs: meetingsFeeds } = await req.payload.find({
      collection: 'meetings-feed',
      where: {
        createdAt: {
          greater_than_equal: oneDayAgoISO,
        },
      },
      limit: 1,
      depth: 0
    })

    // If no feeds found in any collection, create a notification
    if (stocksFeeds.length === 0 || meetingsFeeds.length === 0) {
      let message = `לא התקבל פיד מ-Predictae ביום העבודה האחרון: `;

      if (stocksFeeds.length === 0 && meetingsFeeds.length === 0) {
        message += `מניות ואסיפות`;
      } else if (stocksFeeds.length === 0) {
        message += `מניות`;
      } else {
        message += `אסיפות`;
      }

      await createAdminNotification(
        req.payload,
        message,
        `/admin`,
      )
      notifications.noFeedFromPredictae = true
    }
  } catch (error) {
    req.payload.logger.error(`Error checking Predictae feeds: ${JSON.stringify(error)}`)
  }
}

export default CheckNotificationsEndpoint
