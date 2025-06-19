import { type TaskHandler, Where } from 'payload'
import { addDays, isSameDay } from '@/utils/dateUtils'
import { UserNotificationType } from '@/payload-types'

// Define interface for meeting detail
interface MeetingDetail {
  meetingId: string
  meetingName: string | null | undefined
  companiesProcessed: number
  companiesWithoutVotes: number
  notificationsCreated: {
    afterHoldingLimit: number
    beforeVotingEnd: number
  }
}

/**
 * Checks for company meeting notifications based on specific conditions:
 * 1. A company is invited to a meeting, there is no vote yet published, and we are one day after the holding limit date
 * 2. A company is invited to a meeting, there is no vote yet published, and we are one day before the end of vote time
 */

export const checkCompanyMeetingNotificationsHandler: TaskHandler<
  'checkCompanyMeetingNotifications'
> = async ({ req }) => {
  try {
    const payload = req.payload
    console.log('Starting company meeting notifications check...')
    const today = new Date()

    // Create a detailed results object to track what happened
    const results = {
      meetingsProcessed: 0,
      companiesChecked: 0,
      notificationsCreated: {
        afterHoldingLimit: 0,
        beforeVotingEnd: 0,
      },
      meetingDetails: [] as MeetingDetail[],
    }

    // Find meetings that have a holding limit date of yesterday
    const oneDayAfterHoldingLimit = addDays(today, -1)
    const twoDaysAfterHoldingLimit = addDays(today, -2)

    // Find meetings that have a proxy voting date of tomorrow
    const oneDayBeforeVotingEnd = addDays(today, 1)
    const twoDayBeforeVotingEnd = addDays(today, 2)

    console.log(`oneDayAfterHoldingLimit`, oneDayAfterHoldingLimit)
    console.log(`oneDayBeforeVotingEnd`, oneDayBeforeVotingEnd)
    const query = {
      and: [
        {
          or: [
            {
              // Condition 1: One day after holding limit
              holdingsLimit: {
                greater_than_equal: twoDaysAfterHoldingLimit.toISOString(),
                less_than_equal: oneDayAfterHoldingLimit.toISOString(),
              },
            },
            {
              // Condition 1: One day after holding limit
              proxyVotingDate: {
                greater_than_equal: oneDayBeforeVotingEnd.toISOString(),
                less_than_equal: twoDayBeforeVotingEnd.toISOString(),
              },
            },
          ],
        },
        {
          _status: { equals: 'published' },
          state: { not_equals: 'completed' },
        },
      ],
    } as Where
    console.log('query', JSON.stringify(query))
    // Get all active meetings with the relevant dates
    const meetings = await payload.find({
      collection: 'meetings',
      where: query,
      depth: 1,
      limit: 0,
    })

    console.log(`Found ${meetings.docs.length} meetings with relevant dates`)
    results.meetingsProcessed = meetings.docs.length

    // Process each meeting
    for (const meeting of meetings.docs) {
      const isAfterHoldingLimit =
        meeting.holdingsLimit && isSameDay(new Date(meeting.holdingsLimit), oneDayAfterHoldingLimit)

      const isAfterVotingEnd =
        meeting.proxyVotingDate &&
        isSameDay(new Date(meeting.proxyVotingDate), oneDayBeforeVotingEnd)

      console.log(
        `Meeting:${meeting.id} isAfterHoldingLimit:${isAfterHoldingLimit} isAfterVotingEnd:${isAfterVotingEnd}`,
      )
      if (!isAfterHoldingLimit && !isAfterVotingEnd) {
        continue
      }

      const meetingDetail: MeetingDetail = {
        meetingId: meeting.id,
        meetingName: meeting.fullName,
        companiesProcessed: 0,
        companiesWithoutVotes: 0,
        notificationsCreated: {
          afterHoldingLimit: 0,
          beforeVotingEnd: 0,
        }
      }

      const companiesMeetingsIds = meeting.companies as string[]
      const { docs: companiesMeetings } = await payload.find({
        collection: 'companies',
        select: {
          name: true,
          id: true,
        },
        where: {
          id: { in: companiesMeetingsIds },
        },
        limit: 0,
      })
      console.log(`Found ${companiesMeetings.length} companies for meeting ${meeting.id}`)
      results.companiesChecked += companiesMeetings.length
      meetingDetail.companiesProcessed = companiesMeetings.length

      const { docs: companyVotes } = await payload.find({
        collection: 'votes',
        select: {
          company: true,
        },
        where: {
          meeting: { equals: meeting.id },
          _status: {
            equals: 'published',
          },
        },
        limit: 0,
      })
      const companyVotesSet = new Set()
      companyVotes.forEach((vote) => {
        companyVotesSet.add(vote.company)
      })
      const companyWithoutVotes = companiesMeetings.filter((company) => {
        return !companyVotesSet.has(company.id)
      })
      meetingDetail.companiesWithoutVotes = companyWithoutVotes.length

      // For each company, check if there's already a vote
      for (const company of companyWithoutVotes) {
        // Determine notification type
        let notificationType: UserNotificationType = 'after-holding-limit'
        let message = ''
        if (isAfterHoldingLimit) {
          notificationType = 'after-holding-limit'
          message = `חברה ${company.name} הוזמנה לאסיפה ${meeting.fullName} ואין הצבעה מפורסמת יום אחרי המועד הקובע`
          results.notificationsCreated.afterHoldingLimit++
          meetingDetail.notificationsCreated.afterHoldingLimit++
        } else if (isAfterVotingEnd) {
          notificationType = 'before-voting-end'
          message = `חברה ${company.name} הוזמנה לאסיפה ${meeting.fullName} ואין הצבעה מפורסמת יום לפני מועד מסירת ההצבעות`
          results.notificationsCreated.beforeVotingEnd++
          meetingDetail.notificationsCreated.beforeVotingEnd++
        }

        await payload.create({
          collection: 'company-meeting-notifications',
          data: {
            message,
            notificationType,
            meeting: meeting.id,
            company: company.id,
          },
        })

        console.log(`Created notification for meeting ${meeting.id} and company ${company.id}`)
      }

      results.meetingDetails.push(meetingDetail)
    }

    console.log('Company meeting notifications check completed')
    console.log('Summary:', JSON.stringify(results, null, 2))

    return {
      output: { 
        success: true,
        summary: {
          meetingsProcessed: results.meetingsProcessed,
          companiesChecked: results.companiesChecked,
          notificationsCreated: results.notificationsCreated,
        },
        details: results.meetingDetails
      },
    }
  } catch (error) {
    console.error('Error checking company meeting notifications:', error)
    return {
      output: { success: false, error },
    }
  }
}
