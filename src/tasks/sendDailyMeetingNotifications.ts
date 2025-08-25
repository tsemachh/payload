import { type PayloadRequest, type TaskHandler } from 'payload'
import { isHolidayOrShabbat } from '@/collections/meetings/hooks/calculateHoldingDate'
import { sanitizeRequest } from './utils'
import { Meeting, User } from '@/payload-types'

// Define a global logger variable that will be set in each function with req.payload.logger
let logger: any

// Validation utilities for input validation and data sanitization
/**
 * Returns email content as is
 * @param content Email content
 * @returns The same email content
 */
export const sanitizeEmailContent = (content: string): string => {
  return content
}
// Define interface for task input
export interface DailyMeetingNotificationInput {
  agendaUpdatedMeetingIds?: Array<{ id?: string | null }> | null // Optional input from agenda processing
}

// Define interface for task output
export interface DailyMeetingNotificationResult {
  success: boolean
  summary: {
    newMeetingsCount: number
    agendaUpdatesCount: number
    usersNotified: number
    emailsSent: number
    emailErrors: number
  }
  details?: {
    userEmails: string[]
    errors: string[]
  }
}

/**
 * Query meetings created in the last 24 hours
 * @param req PayloadRequest object for database access
 * @param since Date to query from (24 hours ago)
 * @returns Array of meetings created since the specified date
 */
export const getNewMeetings = async (req: PayloadRequest, since: Date): Promise<Meeting[]> => {
  // Set the global logger to use req.payload.logger
  logger = req.payload.logger

  const startTime = Date.now()
  const sinceISO = since.toISOString()

  // Log query start with detailed parameters
  logger.info('Starting query for new  meetings', {
    operation: 'getNewMeetings',
    since: sinceISO,
    queryParameters: {
      collection: 'meetings',
      createdAtFilter: sinceISO,
      statusFilter: '',
    },
  })

  try {
    const result = await req.payload.find({
      collection: 'meetings',
      select: {
        meetingDate: true,
        fullName: true,
        invitationLink: true,
      },
      where: {
        createdAt: {
          greater_than_equal: sinceISO,
        },
      },
      limit: 0, // Get all results
      depth: 0, // Don't populate relations for performance
    })

    const queryDuration = Date.now() - startTime
    const meetingsFound = result.docs.length

    // Log successful query with performance metrics
    logger.info('Successfully queried new  meetings', {
      operation: 'getNewMeetings',
      meetingsFound,
      queryDuration,
      since: sinceISO,
      performance: {
        executionTimeMs: queryDuration,
        resultsReturned: meetingsFound,
      },
    })
    return result.docs as Meeting[]
  } catch (error) {
    const queryDuration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Enhanced error logging with context and performance data
    logger.error('Failed to query new  meetings', {
      operation: 'getNewMeetings',
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      since: sinceISO,
      queryDuration,
      queryParameters: {
        collection: 'meetings',
        createdAtFilter: sinceISO,
        statusFilter: '',
      },
      stack: error instanceof Error ? error.stack : undefined,
    })

    throw new Error(`Failed to query new  meetings: ${errorMessage}`)
  }
}

/**
 * Query meetings that had agenda updates based on provided meeting IDs
 * @param req PayloadRequest object for database access
 * @param meetingIds Array of meeting IDs that had agenda updates
 * @param since Date to query from (24 hours ago) for additional validation
 * @returns Array of meetings that had agenda updates
 */
export const getAgendaUpdatedMeetings = async (
  req: PayloadRequest,
  meetingIds: string[],
  since: Date,
): Promise<Meeting[]> => {
  // Set the global logger to use req.payload.logger
  logger = req.payload.logger

  const startTime = Date.now()
  const sinceISO = since.toISOString()

  // Log query start with detailed parameters
  logger.info('Starting query for agenda updated meetings', {
    operation: 'getAgendaUpdatedMeetings',
    meetingIdsCount: meetingIds?.length || 0,
    meetingIds: meetingIds?.slice(0, 10), // Log first 10 IDs to avoid log overflow
    since: sinceISO,
    queryParameters: {
      collection: 'meetings',
      idFilter: meetingIds?.length || 0,
      updatedAtFilter: sinceISO,
    },
  })

  try {
    if (!meetingIds || meetingIds.length === 0) {
      logger.info('No meeting IDs provided for agenda updates query', {
        operation: 'getAgendaUpdatedMeetings',
        result: 'empty_input',
        meetingsFound: 0,
      })
      return []
    }

    const result = await req.payload.find({
      collection: 'meetings',
      select: {
        meetingDate: true,
        fullName: true,
        invitationLink: true,
      },
      where: {
        id: {
          in: meetingIds,
        },
        updatedAt: {
          greater_than_equal: sinceISO,
        },
      },
      limit: 0, // Get all results
      depth: 0, // Don't populate relations for performance
    })

    const queryDuration = Date.now() - startTime
    const meetingsFound = result.docs.length

    // Log successful query with performance metrics
    logger.info('Successfully queried agenda updated meetings', {
      operation: 'getAgendaUpdatedMeetings',
      meetingsFound,
      queryDuration,
      inputMeetingIds: meetingIds.length,
      since: sinceISO,
      performance: {
        executionTimeMs: queryDuration,
        resultsReturned: meetingsFound,
        inputSize: meetingIds.length,
      },
    })
    return result.docs as Meeting[]
  } catch (error) {
    const queryDuration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Enhanced error logging with context and performance data
    logger.error('Failed to query agenda updated meetings', {
      operation: 'getAgendaUpdatedMeetings',
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      meetingIdsCount: meetingIds?.length || 0,
      meetingIds: meetingIds?.slice(0, 10), // Log first 10 IDs to avoid log overflow
      since: sinceISO,
      queryDuration,
      queryParameters: {
        collection: 'meetings',
        idFilter: meetingIds?.length || 0,
        updatedAtFilter: sinceISO,
      },
      stack: error instanceof Error ? error.stack : undefined,
    })

    throw new Error(`Failed to query agenda updated meetings: ${errorMessage}`)
  }
}

/**
 * Query active users with companies who should receive notifications
 * @param req PayloadRequest object for database access
 * @returns Array of users who should receive daily meeting notifications
 */
export const getActiveUsersWithCompanies = async (req: PayloadRequest): Promise<User[]> => {
  // Set the global logger to use req.payload.logger
  logger = req.payload.logger

  const startTime = Date.now()

  // Log query start with detailed parameters
  logger.info('Starting query for active users with companies', {
    operation: 'getActiveUsersWithCompanies',
    queryParameters: {
      collection: 'users',
      activeFilter: true,
      receiveMailNotificationFilter: true,
      companiesExistsFilter: true,
      depth: 1,
    },
  })

  try {
    const result = await req.payload.find({
      collection: 'users',
      where: {
        active: {
          equals: true,
        },
        receiveMailNotification: {
          equals: true,
        },
      },
      select: {
        email: true,
        companies: true,
        active: true,
        receiveMailNotification: true,
      },
      limit: 0, // Get all results
      depth: 0, // Populate companies relation
    })

    const queryDuration = Date.now() - startTime
    const totalUsersFound = result.docs.length

    // Filter out users who don't actually have any companies
    const usersWithCompanies = result.docs.filter(
      (user) => user.companies && Array.isArray(user.companies) && user.companies.length > 0,
    ) as User[]

    const validUsersCount = usersWithCompanies.length
    const filteredOutCount = totalUsersFound - validUsersCount

    // Extract email addresses for logging (without exposing actual emails in logs)
    const validEmails = usersWithCompanies
      .map((user) => user.email)
      .filter((email) => email && typeof email === 'string')

    // Log successful query with performance metrics and filtering details
    logger.info('Successfully queried active users with companies', {
      operation: 'getActiveUsersWithCompanies',
      totalUsersFound,
      validUsersCount,
      filteredOutCount,
      validEmailsCount: validEmails.length,
      queryDuration,
      performance: {
        executionTimeMs: queryDuration,
        resultsReturned: totalUsersFound,
        validResults: validUsersCount,
      },
      filtering: {
        totalUsers: totalUsersFound,
        usersWithCompanies: validUsersCount,
        usersFilteredOut: filteredOutCount,
        validEmails: validEmails.length,
      },
    })
    return usersWithCompanies
  } catch (error) {
    const queryDuration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Enhanced error logging with context and performance data
    logger.error('Failed to query active users with companies', {
      operation: 'getActiveUsersWithCompanies',
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      queryDuration,
      queryParameters: {
        collection: 'users',
        activeFilter: true,
        receiveMailNotificationFilter: true,
        companiesExistsFilter: true,
        depth: 1,
      },
      stack: error instanceof Error ? error.stack : undefined,
    })

    throw new Error(`Failed to query active users with companies: ${errorMessage}`)
  }
}

// Define interface for email content
export interface EmailContent {
  subject: string
  html: string
  to: string[]
}

/**
 * Generate Hebrew subject line for daily meeting notifications
 * @returns Hebrew subject line string
 */
export const generateEmailSubject = (): string => {
  return 'עדכון יומי - אסיפות חדשות ועדכונים'
}

/**
 * Generate Hebrew email body with meeting counts and optional links
 * @param newMeetingsCount Number of new meetings  in the last 24 hours
 * @param agendaUpdatesCount Number of meetings with agenda updates in the last 24 hours
 * @param newMeetings Array of new meetings for potential link inclusion
 * @param agendaUpdatedMeetings Array of agenda updated meetings for potential link inclusion
 * @returns HTML email body string with proper RTL formatting
 */
export const generateEmailBody = (
  newMeetingsCount: number,
  agendaUpdatesCount: number,
  newMeetings: Meeting[] = [],
  agendaUpdatedMeetings: Meeting[] = [],
): string => {
  // Use counts as is
  const validatedNewCount = newMeetingsCount
  const validatedAgendaCount = agendaUpdatesCount

  // Start with RTL div container for proper Hebrew text formatting
  let html = '<div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">'

  // Add greeting
  html += '<h1>שלום,</h1>'

  // Add main message with meeting counts
  html += `<p>היום פורסמו ${validatedNewCount} אסיפות חדשות במערכת ו-${validatedAgendaCount} עדכונים לאסיפות.</p>`

  // Add new meetings section with links if available
  if (validatedNewCount > 0 && newMeetings.length > 0) {
    html += '<h3>אסיפות חדשות:</h3>'
    html += '<ul>'

    for (const meeting of newMeetings) {
      html += '<li>'

      // Add meeting name/title if available
      if (meeting.fullName && typeof meeting.fullName === 'string') {
        html += `<strong>${meeting.fullName}</strong>`
      } else if (meeting.meetingId && typeof meeting.meetingId === 'string') {
        html += `<strong>אסיפה ${meeting.meetingId}</strong>`
      } else {
        html += '<strong>אסיפה</strong>'
      }

      // Add meeting link if available
      if (meeting.invitationLink && typeof meeting.invitationLink === 'string') {
        html += ` - <a href="${meeting.invitationLink}" target="_blank">קישור לאסיפה</a>`
      }

      // Add meeting date if available
      if (meeting.meetingDate) {
        try {
          const meetingDate = new Date(meeting.meetingDate)
          const formattedDate = meetingDate.toLocaleDateString('he-IL')
          html += ` (תאריך: ${formattedDate})`
        } catch (error) {
          logger.warn('Failed to format meeting date', {
            meetingId: meeting.id,
            meetingDate: meeting.meetingDate,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      html += '</li>'
    }

    html += '</ul>'
  }

  // Add agenda updates section with links if available
  if (validatedAgendaCount > 0 && agendaUpdatedMeetings.length > 0) {
    html += '<h3>עדכוני סדר יום:</h3>'
    html += '<ul>'

    for (const meeting of agendaUpdatedMeetings) {
      html += '<li>'

      // Add meeting name/title if available
      if (meeting.fullName && typeof meeting.fullName === 'string') {
        html += `<strong>${meeting.fullName}</strong>`
      } else if (meeting.meetingId && typeof meeting.meetingId === 'string') {
        html += `<strong>אסיפה ${meeting.meetingId}</strong>`
      } else {
        html += '<strong>אסיפה</strong>'
      }

      // Add meeting link if available
      if (meeting.invitationLink && typeof meeting.invitationLink === 'string') {
        html += ` - <a href="${meeting.invitationLink}" target="_blank">קישור לאסיפה</a>`
      }

      // Add meeting date if available
      if (meeting.meetingDate) {
        try {
          const meetingDate = new Date(meeting.meetingDate)
          const formattedDate = meetingDate.toLocaleDateString('he-IL')
          html += ` (תאריך: ${formattedDate})`
        } catch (error) {
          logger.warn('Failed to format meeting date', {
            meetingId: meeting.id,
            meetingDate: meeting.meetingDate,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      html += '</li>'
    }

    html += '</ul>'
  }

  // Add closing signature
  html += '<p>בברכה,<br>מערכת עמדה</p>'

  // Close RTL div
  html += '</div>'

  // Sanitize the complete HTML content
  return sanitizeEmailContent(html)
}

/**
 * Generate complete email content for daily meeting notifications
 * @param newMeetingsCount Number of new meetings  in the last 24 hours
 * @param agendaUpdatesCount Number of meetings with agenda updates in the last 24 hours
 * @param recipients Array of email addresses to send to
 * @param newMeetings Array of new meetings for link inclusion (optional)
 * @param agendaUpdatedMeetings Array of agenda updated meetings for link inclusion (optional)
 * @returns Complete email content object with subject, HTML body, and recipients
 */
export const generateEmailContent = (
  newMeetingsCount: number,
  agendaUpdatesCount: number,
  recipients: string[],
  newMeetings: Meeting[] = [],
  agendaUpdatedMeetings: Meeting[] = [],
): EmailContent => {
  // Basic input check
  if (!recipients || recipients.length === 0) {
    throw new Error('No recipients provided for email content generation')
  }

  // Use recipients as is
  const validatedRecipients = recipients

  // Use counts as is
  const validatedNewCount = newMeetingsCount
  const validatedAgendaCount = agendaUpdatesCount

  // Use meetings as is
  const validatedNewMeetings = newMeetings
  const validatedAgendaUpdatedMeetings = agendaUpdatedMeetings

  // Generate subject and body with validated data
  const subject = generateEmailSubject()
  const html = generateEmailBody(
    validatedNewCount,
    validatedAgendaCount,
    validatedNewMeetings,
    validatedAgendaUpdatedMeetings,
  )

  // Log email content generation summary
  logger.info('Email content generated with validation', {
    operation: 'generateEmailContent',
    originalRecipients: recipients.length,
    validatedRecipients: validatedRecipients.length,
    originalNewMeetings: newMeetings.length,
    validatedNewMeetings: validatedNewMeetings.length,
    originalAgendaUpdatedMeetings: agendaUpdatedMeetings.length,
    validatedAgendaUpdatedMeetings: validatedAgendaUpdatedMeetings.length,
    newMeetingsCount: validatedNewCount,
    agendaUpdatesCount: validatedAgendaCount,
  })

  return {
    subject,
    html,
    to: validatedRecipients,
  }
}

/**
 * Core function to send daily meeting notifications
 * This function contains the core logic for sending daily meeting notifications
 * It is used by both the task handler and potential endpoints
 */
export const sendDailyMeetingNotifications = async (
  req: PayloadRequest,
  input?: DailyMeetingNotificationInput,
): Promise<DailyMeetingNotificationResult> => {
  // Set the global logger to use req.payload.logger
  logger = req.payload.logger

  const taskStartTime = Date.now()
  const currentDate = new Date()

  // No validation needed
  const validatedInput: DailyMeetingNotificationInput | undefined = input

  // Log task execution start with comprehensive context
  logger.info('Starting daily meeting notifications task execution', {
    operation: 'sendDailyMeetingNotifications',
    executionStart: currentDate.toISOString(),
    input: {
      agendaUpdatedMeetingIdsCount: validatedInput?.agendaUpdatedMeetingIds?.length || 0,
      hasAgendaUpdates: !!(
        validatedInput?.agendaUpdatedMeetingIds && validatedInput.agendaUpdatedMeetingIds.length > 0
      ),
    },
    context: {
      currentDate: currentDate.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  })

  // Initialize results object
  const results: DailyMeetingNotificationResult = {
    success: true,
    summary: {
      newMeetingsCount: 0,
      agendaUpdatesCount: 0,
      usersNotified: 0,
      emailsSent: 0,
      emailErrors: 0,
    },
    details: {
      userEmails: [],
      errors: [],
    },
  }

  try {
    // Check if it's a working day
    const isNonWorkingDay = isHolidayOrShabbat(currentDate)

    if (isNonWorkingDay) {
      // Log non-working day skip with detailed information
      logger.info('Skipping daily meeting notifications - non-working day', {
        operation: 'sendDailyMeetingNotifications',
        result: 'skipped_non_working_day',
        currentDate: currentDate.toISOString(),
        dayOfWeek: currentDate.getDay(),
        isHoliday: true,
        executionDuration: Date.now() - taskStartTime,
      })
      return {
        success: true,
        summary: {
          newMeetingsCount: 0,
          agendaUpdatesCount: 0,
          usersNotified: 0,
          emailsSent: 0,
          emailErrors: 0,
        },
      }
    }

    // Calculate date 24 hours ago
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    // No validation needed
    const validatedLookbackDate = twentyFourHoursAgo

    // Log data query phase start
    logger.info('Starting data query phase', {
      operation: 'sendDailyMeetingNotifications',
      phase: 'data_queries',
      lookbackPeriod: validatedLookbackDate.toISOString(),
      queryPlan: {
        newMeetingsQuery: true,
        agendaUpdatesQuery: !!(
          input?.agendaUpdatedMeetingIds && input.agendaUpdatedMeetingIds.length > 0
        ),
        usersQuery: true,
      },
    })

    // Query for new  meetings
    let newMeetings: Meeting[] = []
    try {
      const rawNewMeetings = await getNewMeetings(req, validatedLookbackDate)
      // No validation needed
      newMeetings = rawNewMeetings
      results.summary.newMeetingsCount = newMeetings.length

      // Log successful new meetings query
      logger.info('New  meetings query completed successfully', {
        operation: 'sendDailyMeetingNotifications',
        queryType: 'new__meetings',
        rawMeetingsFound: rawNewMeetings.length,
        validatedMeetingsFound: newMeetings.length,
        since: validatedLookbackDate.toISOString(),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Enhanced error logging for new meetings query failure
      logger.error('New  meetings query failed', {
        operation: 'sendDailyMeetingNotifications',
        queryType: 'new__meetings',
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        since: validatedLookbackDate.toISOString(),
        impact: 'continuing_with_partial_data',
        stack: error instanceof Error ? error.stack : undefined,
      })

      results.details?.errors.push(`Failed to query new  meetings: ${errorMessage}`)
      // Continue processing even if this query fails
    }

    // Query for agenda updated meetings if meeting IDs are provided
    let agendaUpdatedMeetings: Meeting[] = []
    if (
      validatedInput?.agendaUpdatedMeetingIds &&
      validatedInput.agendaUpdatedMeetingIds.length > 0
    ) {
      const meetingIds = validatedInput.agendaUpdatedMeetingIds
        .map((item) => item?.id)
        .filter((id) => id != null) as string[]

      try {
        const rawAgendaUpdatedMeetings = await getAgendaUpdatedMeetings(
          req,
          meetingIds,
          validatedLookbackDate,
        )
        // No validation needed
        agendaUpdatedMeetings = rawAgendaUpdatedMeetings
        results.summary.agendaUpdatesCount = agendaUpdatedMeetings.length

        // Log successful agenda updates query
        logger.info('Agenda updated meetings query completed successfully', {
          operation: 'sendDailyMeetingNotifications',
          queryType: 'agenda_updated_meetings',
          inputMeetingIds: meetingIds.length,
          rawMeetingsFound: rawAgendaUpdatedMeetings.length,
          validatedMeetingsFound: agendaUpdatedMeetings.length,
          since: validatedLookbackDate.toISOString(),
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Enhanced error logging for agenda updates query failure
        logger.error('Agenda updated meetings query failed', {
          operation: 'sendDailyMeetingNotifications',
          queryType: 'agenda_updated_meetings',
          error: errorMessage,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          inputMeetingIds: meetingIds.length,
          meetingIds: meetingIds.slice(0, 10), // Log first 10 IDs to avoid overflow
          since: validatedLookbackDate.toISOString(),
          impact: 'continuing_with_partial_data',
          stack: error instanceof Error ? error.stack : undefined,
        })

        results.details?.errors.push(`Failed to query agenda updated meetings: ${errorMessage}`)
        // Continue processing even if this query fails
      }
    } else {
      // Log when no agenda updates are being processed
      logger.info('No agenda updated meeting IDs provided', {
        operation: 'sendDailyMeetingNotifications',
        queryType: 'agenda_updated_meetings',
        result: 'skipped_no_input',
        agendaUpdatesCount: 0,
      })
    }

    // Query for active users with companies
    let activeUsers: User[] = []
    try {
      const rawActiveUsers = await getActiveUsersWithCompanies(req)
      // No validation needed
      activeUsers = rawActiveUsers
      results.summary.usersNotified = activeUsers.length

      // Log successful users query
      logger.info('Active users with companies query completed successfully', {
        operation: 'sendDailyMeetingNotifications',
        queryType: 'active_users_with_companies',
        rawUsersFound: rawActiveUsers.length,
        validatedUsersFound: activeUsers.length,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Enhanced error logging for users query failure
      logger.error('Active users with companies query failed', {
        operation: 'sendDailyMeetingNotifications',
        queryType: 'active_users_with_companies',
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        impact: 'continuing_with_partial_data',
        stack: error instanceof Error ? error.stack : undefined,
      })

      results.details?.errors.push(`Failed to query active users: ${errorMessage}`)
      // Continue processing even if this query fails
    }

    // Log comprehensive query results summary
    const queryPhaseEndTime = Date.now()
    const queryPhaseDuration = queryPhaseEndTime - taskStartTime

    logger.info('Data query phase completed', {
      operation: 'sendDailyMeetingNotifications',
      phase: 'data_queries_complete',
      results: {
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
        usersNotified: results.summary.usersNotified,
        errorsCount: results.details?.errors.length || 0,
      },
      performance: {
        queryPhaseDuration,
        lookbackPeriod: validatedLookbackDate.toISOString(),
      },
      nextPhase: 'email_processing',
    })

    // Log email processing phase start
    logger.info('Starting email processing phase', {
      operation: 'sendDailyMeetingNotifications',
      phase: 'email_processing',
      emailProcessingDecision: {
        usersFound: activeUsers.length,
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
        shouldSendEmails:
          activeUsers.length > 0 &&
          (results.summary.newMeetingsCount > 0 || results.summary.agendaUpdatesCount > 0),
      },
    })

    // Skip email sending if no users to notify
    if (activeUsers.length === 0) {
      logger.info('Skipping email sending - no active users with companies found', {
        operation: 'sendDailyMeetingNotifications',
        phase: 'email_processing',
        result: 'skipped_no_users',
        usersFound: 0,
        reason: 'no_active_users_with_companies',
      })
      return results
    }

    // Skip email sending if no meetings to report
    if (results.summary.newMeetingsCount === 0 && results.summary.agendaUpdatesCount === 0) {
      logger.info('Skipping email sending - no meetings to report', {
        operation: 'sendDailyMeetingNotifications',
        phase: 'email_processing',
        result: 'skipped_no_meetings',
        newMeetingsCount: 0,
        agendaUpdatesCount: 0,
        usersFound: activeUsers.length,
        reason: 'no_meetings_to_report',
      })
      return results
    }

    // Extract user emails for notification
    const userEmails = activeUsers
      .map((user) => user.email)
      .filter((email) => email && typeof email === 'string') as string[]

    if (userEmails.length === 0) {
      logger.error('No valid user emails found for notification', {
        operation: 'sendDailyMeetingNotifications',
        phase: 'email_processing',
        result: 'error_no_valid_emails',
        usersFound: activeUsers.length,
        validEmailsFound: 0,
        reason: 'email_extraction_failed',
      })
      results.details?.errors.push('No valid user emails found for notification')
      return results
    }

    results.details!.userEmails = userEmails

    // Log email recipient details
    logger.info('Email recipients prepared', {
      operation: 'sendDailyMeetingNotifications',
      phase: 'email_processing',
      recipientCount: userEmails.length,
      totalUsersFound: activeUsers.length,
      validEmailsExtracted: userEmails.length,
    })

    // Generate email content
    let emailContent: EmailContent
    const emailGenerationStartTime = Date.now()

    try {
      emailContent = generateEmailContent(
        results.summary.newMeetingsCount,
        results.summary.agendaUpdatesCount,
        userEmails,
        newMeetings,
        agendaUpdatedMeetings,
      )

      const emailGenerationDuration = Date.now() - emailGenerationStartTime

      // Log successful email content generation
      logger.info('Email content generated successfully', {
        operation: 'sendDailyMeetingNotifications',
        phase: 'email_processing',
        recipientCount: userEmails.length,
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
        emailGenerationDuration,
        contentDetails: {
          subjectGenerated: !!emailContent.subject,
          htmlBodyGenerated: !!emailContent.html,
          recipientsSet: emailContent.to.length,
        },
      })
    } catch (error) {
      const emailGenerationDuration = Date.now() - emailGenerationStartTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Enhanced error logging for email content generation failure
      logger.error('Email content generation failed', {
        operation: 'sendDailyMeetingNotifications',
        phase: 'email_processing',
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        recipientCount: userEmails.length,
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
        emailGenerationDuration,
        stack: error instanceof Error ? error.stack : undefined,
      })

      results.details?.errors.push(`Failed to generate email content: ${errorMessage}`)
      results.success = false
      return results
    }

    // Send emails using batch sending with error handling
    const emailSendingStartTime = Date.now()

    // Log email sending phase start
    logger.info('Starting email sending phase', {
      operation: 'sendDailyMeetingNotifications',
      phase: 'email_sending',
      recipientCount: userEmails.length,
      emailDetails: {
        subject: emailContent.subject,
        hasHtmlContent: !!emailContent.html,
        recipientCount: emailContent.to.length,
      },
    })

    try {
      // Split recipients into smaller batches to avoid rate limiting
      const BATCH_SIZE = 5 // Adjust based on email provider's rate limits
      const DELAY_BETWEEN_BATCHES = 1000 // 1 second delay between batches
      const MAX_RETRIES = 3
      const INITIAL_RETRY_DELAY = 2000 // 2 seconds

      // Function to send email to a batch of recipients with retry logic
      const sendEmailBatch = async (batchRecipients: string[], retryCount = 0) => {
        try {
          await req.payload.sendEmail({
            from: process.env.EMAIL_FROM,
            bcc: batchRecipients,
            subject: emailContent.subject,
            html: emailContent.html,
          })
          return { success: true, count: batchRecipients.length }
        } catch (error: any) {
          // Check if it's a rate limiting error
          const isRateLimited =
            error.message &&
            (error.message.includes('429') ||
              error.message.includes('Rate limit') ||
              error.message.toLowerCase().includes('rate limited'))

          if (isRateLimited && retryCount < MAX_RETRIES) {
            // Exponential backoff for retries
            const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
            logger.warn(`Rate limited when sending emails. Retrying in ${retryDelay}ms`, {
              operation: 'sendDailyMeetingNotifications',
              phase: 'email_sending_retry',
              batchSize: batchRecipients.length,
              retryCount: retryCount + 1,
              retryDelay,
              error: error.message,
            })

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
            return sendEmailBatch(batchRecipients, retryCount + 1)
          }

          // If not rate limited or max retries reached, throw the error
          throw error
        }
      }

      // Process batches of recipients
      let successCount = 0
      const batches = []

      // Create batches of recipients
      for (let i = 0; i < emailContent.to.length; i += BATCH_SIZE) {
        batches.push(emailContent.to.slice(i, i + BATCH_SIZE))
      }

      logger.info('Sending emails in batches', {
        operation: 'sendDailyMeetingNotifications',
        phase: 'email_sending',
        totalRecipients: emailContent.to.length,
        batchSize: BATCH_SIZE,
        totalBatches: batches.length,
      })

      // Send emails batch by batch with delay between batches
      for (let i = 0; i < batches.length; i++) {
        try {
          const batchResult = await sendEmailBatch(batches[i])
          successCount += batchResult.count

          logger.info(`Batch ${i + 1}/${batches.length} sent successfully`, {
            operation: 'sendDailyMeetingNotifications',
            phase: 'email_sending',
            batchNumber: i + 1,
            totalBatches: batches.length,
            batchSize: batches[i].length,
            successCount,
          })

          // Add delay between batches (except after the last batch)
          if (i < batches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
          }
        } catch (batchError: any) {
          logger.error(
            `Failed to send batch ${i + 1}/${batches.length}`,
            {
              operation: 'sendDailyMeetingNotifications',
              phase: 'email_sending',
              batchNumber: i + 1,
              totalBatches: batches.length,
              batchSize: batches[i].length,
              error: batchError.message,
            },
            batchError,
          )

          // Continue with next batch even if this one failed
          results.details?.errors.push(
            `Failed to send emails to batch ${i + 1}/${batches.length} (${batches[i].length} recipients): ${batchError.message}`,
          )
        }
      }

      const emailSendingDuration = Date.now() - emailSendingStartTime

      // Log successful email sending
      results.summary.emailsSent = successCount
      results.summary.emailErrors = emailContent.to.length - successCount

      // Enhanced success logging with comprehensive details
      logger.info('Daily meeting notification emails sending completed', {
        operation: 'sendDailyMeetingNotifications',
        phase: 'email_sending',
        result: successCount > 0 ? 'success' : 'failure',
        recipientCount: userEmails.length,
        successCount,
        errorCount: emailContent.to.length - successCount,
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
        emailSendingDuration,
        emailDetails: {
          subject: emailContent.subject,
          recipientCount: emailContent.to.length,
          emailsSent: successCount,
          emailErrors: emailContent.to.length - successCount,
        },
        performance: {
          emailSendingTimeMs: emailSendingDuration,
          batchSize: BATCH_SIZE,
          batchCount: batches.length,
        },
      })

      // Also log to payload logger for backward compatibility
      req.payload.logger.info('Daily meeting notification emails sending completed', {
        recipientCount: userEmails.length,
        successCount,
        errorCount: emailContent.to.length - successCount,
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
      })
    } catch (error) {
      const emailSendingDuration = Date.now() - emailSendingStartTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Enhanced error logging for email sending failure
      logger.error('Daily meeting notification emails sending failed', {
        operation: 'sendDailyMeetingNotifications',
        phase: 'email_sending',
        result: 'failure',
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        recipientCount: userEmails.length,
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
        emailSendingDuration,
        emailDetails: {
          subject: emailContent.subject,
          recipientCount: emailContent.to.length,
          emailsSent: 0,
          emailErrors: userEmails.length,
        },
        affectedUsers: userEmails.length,
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Update results with error information
      results.summary.emailErrors = userEmails.length
      results.details?.errors.push(
        `Failed to send emails to ${userEmails.length} recipients: ${errorMessage}`,
      )
      results.success = false
    }

    // Log task completion summary
    const totalExecutionDuration = Date.now() - taskStartTime

    logger.info('Daily meeting notifications task execution completed', {
      operation: 'sendDailyMeetingNotifications',
      phase: 'task_complete',
      result: results.success ? 'success' : 'partial_failure',
      executionSummary: {
        totalExecutionDuration,
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
        usersNotified: results.summary.usersNotified,
        emailsSent: results.summary.emailsSent,
        emailErrors: results.summary.emailErrors,
        errorsCount: results.details?.errors.length || 0,
      },
      performance: {
        totalExecutionTimeMs: totalExecutionDuration,
        queryPhaseDuration: queryPhaseDuration,
        emailProcessingDuration: Date.now() - queryPhaseEndTime,
      },
      healthStatus: {
        overallSuccess: results.success,
        hasErrors: (results.details?.errors.length || 0) > 0,
        emailDeliverySuccess: results.summary.emailsSent > 0 && results.summary.emailErrors === 0,
      },
    })

    return results
  } catch (error) {
    const totalExecutionDuration = Date.now() - taskStartTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    req.payload.logger.error({
      err: error,
      msg: 'Error in sendDailyMeetingNotifications',
    })

    // Enhanced error logging for unexpected task failures
    logger.error('Daily meeting notifications task failed with unexpected error', {
      operation: 'sendDailyMeetingNotifications',
      phase: 'task_failure',
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      totalExecutionDuration,
      partialResults: {
        newMeetingsCount: results.summary.newMeetingsCount,
        agendaUpdatesCount: results.summary.agendaUpdatesCount,
        usersNotified: results.summary.usersNotified,
        emailsSent: results.summary.emailsSent,
        emailErrors: results.summary.emailErrors,
      },
      stack: error instanceof Error ? error.stack : undefined,
    })

    results.success = false
    results.details?.errors.push(errorMessage)
    return results
  }
}

/**
 * Task handler for sending daily meeting notifications
 * Runs at 10:00 PM on working days to notify users about new meetings and agenda updates
 */
export const sendDailyMeetingNotificationsHandler: TaskHandler<
  'sendDailyMeetingNotifications'
> = async ({ input, req }) => {
  // Set the global logger to use req.payload.logger
  logger = req.payload.logger

  const handlerStartTime = Date.now()

  // No validation needed
  const validatedInput: DailyMeetingNotificationInput | undefined = input

  // Log task handler start with comprehensive context
  logger.info('Daily meeting notifications task handler started', {
    operation: 'sendDailyMeetingNotificationsHandler',
    handlerStart: new Date().toISOString(),
    input: {
      provided: !!validatedInput,
      agendaUpdatedMeetingIdsCount: validatedInput?.agendaUpdatedMeetingIds?.length || 0,
    },
    context: {
      taskType: 'sendDailyMeetingNotifications',
      executionEnvironment: process.env.NODE_ENV || 'unknown',
    },
  })

  try {
    console.log('sendDailyMeetingNotificationsHandler started')

    // Sanitize request to ensure proper user context
    await sanitizeRequest(req)

    // Call the core function with validated input
    const result = await sendDailyMeetingNotifications(req, validatedInput)

    const handlerExecutionDuration = Date.now() - handlerStartTime

    // Enhanced task completion logging
    if (result.success) {
      logger.info('Daily meeting notifications task handler completed successfully', {
        operation: 'sendDailyMeetingNotificationsHandler',
        result: 'success',
        handlerExecutionDuration,
        summary: result.summary,
        performance: {
          totalHandlerTimeMs: handlerExecutionDuration,
        },
        systemHealth: {
          taskSuccess: true,
          emailDeliverySuccess: result.summary.emailsSent > 0 && result.summary.emailErrors === 0,
          hasErrors: (result.details?.errors.length || 0) > 0,
        },
      })

      // Also log to payload logger for backward compatibility
      req.payload.logger.info('Daily meeting notifications task completed successfully', {
        summary: result.summary,
      })
    } else {
      logger.error('Daily meeting notifications task handler completed with errors', {
        operation: 'sendDailyMeetingNotificationsHandler',
        result: 'failure',
        handlerExecutionDuration,
        summary: result.summary,
        errors: result.details?.errors,
        errorCount: result.details?.errors.length || 0,
        performance: {
          totalHandlerTimeMs: handlerExecutionDuration,
        },
        systemHealth: {
          taskSuccess: false,
          emailDeliverySuccess: false,
          hasErrors: true,
        },
      })

      // Also log to payload logger for backward compatibility
      req.payload.logger.error('Daily meeting notifications task completed with errors', {
        summary: result.summary,
        errors: result.details?.errors,
      })
    }

    return {
      output: result,
    }
  } catch (error) {
    const handlerExecutionDuration = Date.now() - handlerStartTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    req.payload.logger.error({
      err: error,
      msg: 'Error in sendDailyMeetingNotificationsHandler',
    })

    // Enhanced error logging for task handler failures
    logger.error('Daily meeting notifications task handler failed with unexpected error', {
      operation: 'sendDailyMeetingNotificationsHandler',
      result: 'handler_failure',
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      handlerExecutionDuration,
      input: {
        provided: !!input,
        agendaUpdatedMeetingIdsCount: input?.agendaUpdatedMeetingIds?.length || 0,
      },
      systemHealth: {
        taskSuccess: false,
        handlerFailure: true,
        criticalError: true,
      },
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Also log to payload logger for backward compatibility
    req.payload.logger.error(
      `Error in sendDailyMeetingNotifications task: ${JSON.stringify(error)}`,
    )

    return {
      output: {
        success: false,
        summary: {
          newMeetingsCount: 0,
          agendaUpdatesCount: 0,
          usersNotified: 0,
          emailsSent: 0,
          emailErrors: 1,
        },
        details: {
          userEmails: [],
          errors: [errorMessage],
        },
      },
    }
  }
}
