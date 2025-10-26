import { type TaskHandler } from 'payload'
import { Company, CompanyMeetingNotification, User } from '@/payload-types'
import { scheduleSendCompanyMeetingNotificationsTask } from '@/tasks/scheduleDailyTasks'
import { isWorkingDay } from '@/collections/meetings/hooks/calculateHoldingDate'
import { sanitizeRequest } from '@/tasks/utils'
import { sendMail } from '@/utils/sendMail'
import { companyNotificationTypeOptions, getCompanyNotificationTypeLabel, COMPANY_NOTIFICATION_KNOWN_TYPES } from '@/collections/company-meeting-notifications/typeOptions'

// Define interface for company detail
interface CompanyDetail {
  companyId: string
  companyName: string
  recipientEmails: string[]
  notificationsSent: Record<string, number> & { total: number }
  emailStatus: string
}

/**
 * Core function to send company meeting notifications
 * This function contains the core logic for sending company meeting notifications
 * It is used by both the task handler and the endpoint
 */
export const sendCompanyMeetingNotifications = async (req: any) => {
  const payload = req.payload
  console.log('Starting company meeting notifications email sending...')

  // Create a detailed results object
  const typeValues = companyNotificationTypeOptions
    .map((o) => o.value)
    .filter(Boolean) as string[]
  const zeroedByType: Record<string, number> = {}
  for (const t of typeValues) zeroedByType[t] = 0

  const results = {
    notificationsFound: 0,
    companiesProcessed: 0,
    emailsSent: 0,
    emailErrors: 0,
    notificationsByType: { ...zeroedByType } as Record<string, number>,
    companyDetails: [] as CompanyDetail[],
  }
  if (!isWorkingDay(new Date())) {
    return {
      success: true,
      message: 'non working day',
    }
  }
  // Use last working day window
  const { getLastWorkingDayWindow } = await import('@/utils/workingDayWindow')
  const { start, end } = getLastWorkingDayWindow(new Date())
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  // Get all notifications in the last working day window
  const notifications = await payload.find({
    collection: 'company-meeting-notifications',
    where: {
      createdAt: {
        greater_than_equal: startISO,
        less_than: endISO,
      },
    },
    depth: 2, // Load related data
    limit: 0,
  })

  console.log(`Found ${notifications.docs.length} notifications to send`)
  results.notificationsFound = notifications.docs.length

  if (notifications.docs.length === 0) {
    return {
      success: true,
      message: 'No notifications to send',
      summary: results,
    }
  }

  // Group notifications by user
  const { docs: users } = await payload.find({
    collection: 'users',
    select: {
      companies: true,
      email: true,
    },
    where: {
      active: {
        equals: true,
      },
      receiveMailNotification: {
        equals: true,
      },
    },
    limit: 0,
  })
  const usersPerCompany = new Map<string, string[]>()
  users.forEach((user: User) => {
    user?.companies?.forEach((company) => {
      let users = usersPerCompany.get(company?.companyId as string)
      if (!users) {
        users = []
      }
      if (company?.permission == 'write') users.push(user.email)
      usersPerCompany.set(company?.companyId as string, users)
    })
  })

  // Send emails to each user
  for (const [companyId, usersMails] of usersPerCompany.entries()) {
    const companyNotifications = notifications.docs.filter(
      (notification: CompanyMeetingNotification) => {
        return (notification?.company as Company)?.id === companyId
      },
    )
    // Skip if no notifications for this user
    if (companyNotifications.length === 0) {
      continue
    }

    results.companiesProcessed++

    const companyDetail: CompanyDetail = {
      companyId,
      companyName: '',
      recipientEmails: usersMails,
      notificationsSent: { total: companyNotifications.length } as Record<string, number> & { total: number },
      emailStatus: 'pending',
    }

    // Group notifications by type using centralized options
    const orderedGroups = companyNotificationTypeOptions.map((opt) => ({
      opt,
      items: companyNotifications.filter(
        (n: CompanyMeetingNotification) => n.notificationType === opt.value,
      ),
    }))

    const otherNotifications: CompanyMeetingNotification[] = []
    for (const n of companyNotifications) {
      if (!COMPANY_NOTIFICATION_KNOWN_TYPES.has(n.notificationType as any)) {
        otherNotifications.push(n)
      }
    }

    // Update counters dynamically
    for (const { opt, items } of orderedGroups) {
      companyDetail.notificationsSent[opt.value as string] = items.length
      results.notificationsByType[opt.value as string] =
        (results.notificationsByType[opt.value as string] || 0) + items.length
    }

    const companyName = (companyNotifications[0].company as Company).name
    // Create email content
    const subject = `סיכום התראות חברה - ${companyName}`
    companyDetail.companyName = companyName
    let html = `<div dir=\"rtl\"><h1>שלום ${companyName},</h1>`
    html += '<h2>להלן סיכום התראות אסיפות חברה:</h2>'

    // Render sections dynamically using centralized labels
    for (const { opt, items } of orderedGroups) {
      if (items.length === 0) continue
      html += `<h3>${opt.label}:</h3><ul>`
      for (const notification of items) {
        html += `<li>${notification.message}</li>`
      }
      html += '</ul>'
    }

    if (otherNotifications.length > 0) {
      html += `<h3>התראות אחרות:</h3><ul>`
      for (const notification of otherNotifications) {
        const label = getCompanyNotificationTypeLabel(notification.notificationType as any)
        html += `<li>[${label}] ${notification.message}</li>`
      }
      html += '</ul>'
    }

    html += '<p>בברכה,<br>מערכת עמדה</p></div>'

    // Send the email
    try {
      await sendMail(payload, {
        from: process.env.EMAIL_FROM,
        to: usersMails,
        subject,
        html,
      })

      console.log(`Sent email to ${usersMails}`)
      results.emailsSent++
      companyDetail.emailStatus = 'sent'
    } catch (error) {
      req.payload.logger.error({
        err: error,
        msg: `Error sending email to ${companyName}`,
      })
      results.emailErrors++
      companyDetail.emailStatus = 'error'
    }

    results.companyDetails.push(companyDetail)
  }

  console.log('Company meeting notifications email sending completed')
  console.log('Summary:', JSON.stringify(results, null, 2))

  return {
    success: true,
    summary: {
      notificationsFound: results.notificationsFound,
      companiesProcessed: results.companiesProcessed,
      emailsSent: results.emailsSent,
      emailErrors: results.emailErrors,
      notificationsByType: results.notificationsByType,
    },
    details: results.companyDetails,
  }
}

/**
 * Sends daily email notifications to users who have opted in to receive them.
 * Groups notifications by user and sends a summary email.
 */
export const sendCompanyMeetingNotificationsHandler: TaskHandler<
  'sendCompanyMeetingNotifications'
> = async ({ req }) => {
  try {
    await sanitizeRequest(req, 'sendCompanyMeetingNotifications')
    // Call the core function
    const result = await sendCompanyMeetingNotifications(req)

    // Reschedule the task
    await scheduleSendCompanyMeetingNotificationsTask(req.payload)
    console.log('Rescheduled sendCompanyMeetingNotifications task')

    return {
      output: result,
    }
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Error sending company meeting notifications',
    })
    return { output: { success: false, error } }
  }
}
