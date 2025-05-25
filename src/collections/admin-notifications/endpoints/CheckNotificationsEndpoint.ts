import { PayloadRequest } from 'payload'
import { createAdminNotification } from '@/utils/utils'

/**
 * Endpoint to check for various conditions and create notifications
 * 1. Companies not feeding holdings for more than 2 days
 * 2. Companies not voting on meetings happening in 1 day
 * 3. No feed from Predictae in the past day
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

    // 1. Check companies not feeding holdings for more than 2 days
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
 * Check companies not feeding holdings for more than 2 days
 */
async function checkHoldingsFeeds(req: PayloadRequest, notifications: any) {
  try {
    // Get current date
    const now = new Date()

    // Calculate date 2 days ago
    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(now.getDate() - 2)
    const twoDaysAgoISO = twoDaysAgo.toISOString()

    // Find all companies
    const { docs: companies } = await req.payload.find({
      collection: 'companies',
      limit: 1000,
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
            greater_than_equal: twoDaysAgoISO,
          },
        },
        sort: '-valueDate',
        limit: 1,
      })

      // If no holdings feed found, create a notification
      if (holdingsFeeds.length === 0) {
        await createAdminNotification(
          req.payload,
          `חברה ${company.name || company.id} לא דיווחה על אחזקות במשך יותר מ-2 ימים`,
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
 * Check companies not voting on meetings happening in 1 day
 */
async function checkMeetingVotes(req: PayloadRequest, notifications: any) {
  try {
    // Get current date
    const now = new Date()

    // Calculate tomorrow's date
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const tomorrowStart = new Date(tomorrow)
    tomorrowStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(23, 59, 59, 999)

    // Find meetings happening tomorrow
    const { docs: tomorrowMeetings } = await req.payload.find({
      collection: 'meetings',
      where: {
        meetingDate: {
          greater_than_equal: tomorrowStart.toISOString(),
          less_than_equal: tomorrowEnd.toISOString(),
        },
      },
      limit: 1000,
    })

    // For each meeting, check which companies should vote but haven't
    for (const meeting of tomorrowMeetings) {
      // Get companies related to this meeting
      if (
        !meeting.companies ||
        !Array.isArray(meeting.companies) ||
        meeting.companies.length === 0
      ) {
        continue
      }

      const meetingCompanyIds = meeting.companies.map((company) =>
        typeof company === 'string' ? company : company.id,
      )

      // Find votes for this meeting
      const { docs: votes } = await req.payload.find({
        collection: 'votes',
        where: {
          meeting: {
            equals: meeting.id,
          },
          _status: {
            equals: 'published',
          },
        },
        limit: 1000,
      })

      // Get companies that have voted
      const votedCompanyIds = new Set()
      votes.forEach((vote) => {
        if (vote.companies && Array.isArray(vote.companies)) {
          vote.companies.forEach((company) => {
            const companyId = typeof company === 'string' ? company : company.id
            votedCompanyIds.add(companyId)
          })
        }
      })

      // Find companies that should vote but haven't
      const notVotedCompanyIds = meetingCompanyIds.filter((id) => !votedCompanyIds.has(id))

      // Create notifications for companies that haven't voted
      for (const companyId of notVotedCompanyIds) {
        // Get company details
        const company = await req.payload.findByID({
          collection: 'companies',
          id: companyId,
        })

        await createAdminNotification(
          req.payload,
          `חברה ${company.name || companyId} לא הצביעה באסיפה שתתקיים מחר: ${meeting.meetingId || meeting.meetingId || meeting.id}`,
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
 * Check if there was no feed from Predictae in the past day
 */
async function checkPredictaeFeeds(req: PayloadRequest, notifications: any) {
  try {
    // Get current date
    const now = new Date()

    // Calculate date 1 day ago
    const oneDayAgo = new Date(now)
    oneDayAgo.setDate(now.getDate() - 1)
    const oneDayAgoISO = oneDayAgo.toISOString()

    // Check for any feed in the last 24 hours
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
    })

    // Check holdings feed
    const { docs: holdingsFeeds } = await req.payload.find({
      collection: 'holdings-feed',
      where: {
        createdAt: {
          greater_than_equal: oneDayAgoISO,
        },
      },
      limit: 1,
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
    })

    // If no feeds found in any collection, create a notification
    if (stocksFeeds.length === 0 && holdingsFeeds.length === 0 && meetingsFeeds.length === 0) {
      await createAdminNotification(
        req.payload,
        `לא התקבל פיד מ-Predictae ב-24 השעות האחרונות`,
        `/admin`,
      )
      notifications.noFeedFromPredictae = true
    }
  } catch (error) {
    req.payload.logger.error(`Error checking Predictae feeds: ${JSON.stringify(error)}`)
  }
}

export default CheckNotificationsEndpoint
