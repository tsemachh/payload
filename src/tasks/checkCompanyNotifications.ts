import { type TaskHandler, Where } from 'payload'
import { addDays, setToMidnight } from '@/utils/dateUtils'
import { UserNotificationType } from '@/payload-types'
import { scheduleCheckCompanyNotificationsTask } from '@/tasks/scheduleDailyTasks'
import { format } from 'date-fns'
import {
  getWorkingDateBefore,
  isWorkingDay,
} from '@/collections/meetings/hooks/calculateHoldingDate'
import { sanitizeRequest } from '@/tasks/utils'

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
 * Checks for company notifications based on specific conditions:
 * 1. A company is invited to a meeting, there is no vote yet published, and the holding limit date is between yesterday midnight and today midnight
 * 2. A company is invited to a meeting, there is no vote yet published, and the proxy voting date is between today midnight and tomorrow midnight
 * 3. A company has not fed holdings for more than 5 working days
 */

/**
 * Core function to check company notifications
 * This function contains the core logic for checking company notifications
 * It is used by both the task handler and the endpoint
 */
export const checkCompanyNotifications = async (req: any) => {
  console.log('Starting company notifications check...')
  const today = new Date()

  // Create a detailed results object to track what happened
  const results = {
    meetingsProcessed: 0,
    companiesChecked: 0,
    notificationsCreated: {
      afterHoldingLimit: 0,
      beforeVotingEnd: 0,
      holdingsNotFed: 0,
    },
    meetingDetails: [] as MeetingDetail[],
  }

  if (!isWorkingDay(today)) {
    return {
      success: true,
      message: 'non working day',
    }
  }

  // Set up midnight timestamps for date ranges
  const todayMidnight = setToMidnight(today)
  const yesterdayMidnight = setToMidnight(addDays(today, -1))
  const tomorrowMidnight = setToMidnight(addDays(today, 1))

  // 1. Check for meeting notifications
  await checkMeetingNotifications(req, results, todayMidnight, yesterdayMidnight, tomorrowMidnight)

  // 2. Check for holdings feed notifications
  await checkCompanyHoldingsFeeds(req, results)
  await checkMeetingUpdates(req, results)
  console.log('Company notifications check completed')
  console.log('Summary:', JSON.stringify(results, null, 2))

  return {
    success: true,
    summary: {
      meetingsProcessed: results.meetingsProcessed,
      companiesChecked: results.companiesChecked,
      notificationsCreated: results.notificationsCreated,
    },
    details: results.meetingDetails,
  }
}

export const checkCompanyNotificationsHandler: TaskHandler<'checkCompanyNotifications'> = async ({
  req,
}) => {
  try {
    await sanitizeRequest(req, 'checkCompanyNotifications')
    // Call the core function
    const result = await checkCompanyNotifications(req)

    // Reschedule the task
    await scheduleCheckCompanyNotificationsTask(req.payload)
    console.log('Rescheduled checkCompanyNotifications task')

    return {
      output: result,
    }
  } catch (error) {
    console.error('Error checking company notifications:', error)
    return {
      output: { success: false, error },
    }
  }
}

/**
 * Check for meeting notifications
 */
async function checkMeetingNotifications(
  req: any,
  results: any,
  todayMidnight: Date,
  yesterdayMidnight: Date,
  tomorrowMidnight: Date,
) {
  const payload = req.payload
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
    if (!companiesMeetingsIds) break
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
    companyVotes.forEach((vote: any) => {
      companyVotesSet.add(vote.company)
    })
    const companyWithoutVotes = companiesMeetings.filter((company: any) => {
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
        message = `יש להצביע ב${meeting.fullName},חברה ${company.name} הוזמנה לאסיפה ואין הצבעה יום לפני מועד מסירת ההצבעות  ב${formattedDate}`
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
}

/**
 * Check companies not feeding holdings for more than 5 working days
 */
async function checkCompanyHoldingsFeeds(req: any, results: any) {
  try {
    const payload = req.payload
    console.log('Checking companies not feeding holdings...')

    // Get current date
    const now = new Date()

    // Number of working days to check (configurable)
    const workingDaysToCheck = 5

    // Calculate date for working days ago using getWorkingDateBefore
    const workingDaysAgo = getWorkingDateBefore(now, workingDaysToCheck, 12)
    const workingDaysAgoISO = workingDaysAgo.toISOString()

    console.log(`Checking holdings feeds since ${workingDaysAgoISO}`)

    // Find all companies
    const { docs: companies } = await payload.find({
      collection: 'companies',
      select: {
        name: true,
        subCompanies: true,
      },
      where: {
        type: {
          equals: 'regular',
        },
        active: {
          equals: true,
        },
      },
      limit: 0,
      depth: 0,
    })

    console.log(`Found ${companies.length} companies to check for holdings feeds`)

    // For each company, check if they have holdings after workingDaysAgo
    for (const company of companies) {
      let hasHoldings = true
      if (company && company.subCompanies && Array.isArray(company.subCompanies)) {
        // Add each subCompany as a child
        const funds = company.subCompanies
        for (const fund of funds) {
          // Find the latest holding feed for this fund
          const { docs: holdingsFeeds } = await payload.find({
            collection: 'holdings',
            where: {
              fund: {
                equals: fund,
              },
              valueDate: {
                greater_than_equal: workingDaysAgoISO,
              },
            },
            sort: '-valueDate',
            limit: 1,
          })
          if (holdingsFeeds.length === 0) {
            //If one of the funds is missing holdings then we notify user
            hasHoldings = false
            break
          }
        }
      }

      // If no holdings feed found, create a notification
      if (!hasHoldings) {
        const message = `חברה ${company.name} לא דיווחה על החזקות במשך יותר מ-${workingDaysToCheck} ימי עבודה`

        // Delete any existing notifications for this company and type
        await payload.delete({
          collection: 'company-meeting-notifications',
          where: {
            company: { equals: company.id },
            message: { equals: message },
            notificationType: { equals: 'holdings-not-fed' },
          },
        })

        // Create new notification
        await payload.create({
          collection: 'company-meeting-notifications',
          data: {
            message,
            notificationType: 'holdings-not-fed',
            company: company.id,
          },
        })

        results.notificationsCreated.holdingsNotFed++
        console.log(`Created holdings notification for company ${company.id}: ${company.name}`)
      }
    }

    console.log(`Created ${results.notificationsCreated.holdingsNotFed} holdings notifications`)
  } catch (error) {
    console.error(error)
    console.error(`Error checking holdings feeds: ${JSON.stringify(error)}`)
  }
}
async function checkMeetingUpdates(req: any, results: any, userId?: string) {
  const payload = req.payload
  const today = new Date()
  const yesterday = new Date(today)
  const formattedYesterday = yesterday.toLocaleDateString('he-IL')
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStart = new Date(yesterday)
  yesterdayStart.setHours(0, 0, 0, 0)
  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setHours(23, 59, 59, 999)

  const { docs: meetings } = await payload.find({
    collection: 'meetings',
    select: {
      companies: true,
      id: true,
      fullName: true,
    },
    where: {
      _status: { equals: 'published' },
      publishDate: {
        less_than_equal: yesterdayStart.toISOString(),
      },
      updatedAt: {
        greater_than_equal: yesterdayStart.toISOString(),
        less_than_equal: today,
      },
      changeDetails: {
        not_equals: null,
      },
    },
    limit: 0,
    depth: 0,
  })

  for (const meeting of meetings) {
    const companies = meeting.companies as string[]
    if (!companies || companies.length === 0) continue

    for (const companyId of companies) {
      const message = `אסיפה ${meeting.fullName} עודכנה בתאריך (${formattedYesterday}), יש לשים לב לשינויים`
      await payload.delete({
        collection: 'company-meeting-notifications',
        where: {
          company: { equals: companyId },
          message: { equals: message },
          notificationType: { equals: 'meeting-updated' },
          meeting: { equals: meeting.id },
        },
      })
      await payload.create({
        collection: 'company-meeting-notifications',
        data: {
          message,
          notificationType: 'meeting-updated',
          meeting: meeting.id,
          company: companyId,
        },
      })

      //(`Created update notification for company ${companyId} in meeting ${meeting.id}`)
      results.notificationsCreated.meetingUpdates =
        (results.notificationsCreated.meetingUpdates || 0) + 1
    }
  }
}
