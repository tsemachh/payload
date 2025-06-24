import { type TaskHandler, Where } from 'payload'
import { addDays, setToMidnight } from '@/utils/dateUtils'
import { UserNotificationType } from '@/payload-types'
import { scheduleCheckCompanyMeetingNotificationsTask } from '@/tasks/scheduleDailyTasks'
import { format } from 'date-fns'

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
 * 1. A company is invited to a meeting, there is no vote yet published, and the holding limit date is between yesterday midnight and today midnight
 * 2. A company is invited to a meeting, there is no vote yet published, and the proxy voting date is between today midnight and tomorrow midnight
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

    // Set up midnight timestamps for date ranges
    const todayMidnight = setToMidnight(today)
    const yesterdayMidnight = setToMidnight(addDays(today, -1))
    const tomorrowMidnight = setToMidnight(addDays(today, 1))

    console.log(`yesterdayMidnight`, yesterdayMidnight)
    console.log(`todayMidnight`, todayMidnight)
    console.log(`tomorrowMidnight`, tomorrowMidnight)

    const query = {
      and: [
        {
          or: [
            {
              // Condition 1: holdingLimit between yesterday midnight and today midnight
              holdingsLimit: {
                greater_than: yesterdayMidnight.toISOString(),
                less_than: todayMidnight.toISOString(),
              },
            },
            {
              // Condition 2: proxyVotingDate between today midnight and tomorrow midnight
              proxyVotingDate: {
                greater_than: todayMidnight.toISOString(),
                less_than: tomorrowMidnight.toISOString(),
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
      const holdingLimitDate = meeting.holdingsLimit ? new Date(meeting.holdingsLimit) : null
      const proxyVotingDate = meeting.proxyVotingDate ? new Date(meeting.proxyVotingDate) : null

      const isAfterHoldingLimit =
        holdingLimitDate && holdingLimitDate > yesterdayMidnight && holdingLimitDate < todayMidnight

      const isAfterVotingEnd =
        proxyVotingDate && proxyVotingDate > todayMidnight && proxyVotingDate < tomorrowMidnight

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
        },
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
        if (isAfterHoldingLimit && holdingLimitDate) {
          notificationType = 'after-holding-limit'
          const formattedDate = format(holdingLimitDate, 'dd/MM/yyyy')
          message = `יש להצביע ב${meeting.fullName},מועד הקובע חלף ב${formattedDate}`
          results.notificationsCreated.afterHoldingLimit++
          meetingDetail.notificationsCreated.afterHoldingLimit++
        } else if (isAfterVotingEnd && proxyVotingDate) {
          notificationType = 'before-voting-end'
          const formattedDate = format(proxyVotingDate, 'dd/MM/yyyy')
          message = `יש להצביע ב${meeting.fullName},חברה ${company.name} הוזמנה לאסיפה ואין הצבעה מפורסמת יום לפני מועד מסירת ההצבעות  ב${formattedDate}`
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

    // Reschedule the task
    await scheduleCheckCompanyMeetingNotificationsTask(req.payload)
    console.log('Rescheduled checkCompanyMeetingNotifications task')

    return {
      output: {
        success: true,
        summary: {
          meetingsProcessed: results.meetingsProcessed,
          companiesChecked: results.companiesChecked,
          notificationsCreated: results.notificationsCreated,
        },
        details: results.meetingDetails,
      },
    }
  } catch (error) {
    console.error('Error checking company meeting notifications:', error)
    return {
      output: { success: false, error },
    }
  }
}
