import { type TaskHandler } from 'payload'
import { Company, CompanyMeetingNotification, User } from '@/payload-types'
import { scheduleSendCompanyMeetingNotificationsTask } from '@/tasks/scheduleDailyTasks'

// Define interface for company detail
interface CompanyDetail {
  companyId: string
  companyName: string
  recipientEmails: string[]
  notificationsSent: {
    total: number
    afterHoldingLimit: number
    beforeVotingEnd: number
  }
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
  const results = {
    notificationsFound: 0,
    companiesProcessed: 0,
    emailsSent: 0,
    emailErrors: 0,
    notificationsByType: {
      afterHoldingLimit: 0,
      beforeVotingEnd: 0,
    },
    companyDetails: [] as CompanyDetail[],
  }

  // Calculate date 24 hours ago
  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
  const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString()

  // Get all notifications that haven't been emailed yet
  const notifications = await payload.find({
    collection: 'company-meeting-notifications',
    where: {
      createdAt: {
        greater_than_equal: twentyFourHoursAgoISO,
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
  users.forEach((user:User) => {
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
    const companyNotifications = notifications.docs.filter((notification:CompanyMeetingNotification) => {
      return (notification?.company as Company)?.id === companyId
    })
    // Skip if no notifications for this user
    if (companyNotifications.length === 0) {
      continue
    }

    results.companiesProcessed++

    const companyDetail: CompanyDetail = {
      companyId,
      companyName: '',
      recipientEmails: usersMails,
      notificationsSent: {
        total: companyNotifications.length,
        afterHoldingLimit: 0,
        beforeVotingEnd: 0,
      },
      emailStatus: 'pending',
    }

    // Group notifications by type
    const afterHoldingLimit = companyNotifications.filter(
      (n:CompanyMeetingNotification) => n.notificationType === 'after-holding-limit',
    )
    const beforeVotingEnd = companyNotifications.filter(
      (n:CompanyMeetingNotification) => n.notificationType === 'before-voting-end',
    )

    // Count notifications by type
    companyDetail.notificationsSent.afterHoldingLimit = afterHoldingLimit.length
    companyDetail.notificationsSent.beforeVotingEnd = beforeVotingEnd.length
    results.notificationsByType.afterHoldingLimit += afterHoldingLimit.length
    results.notificationsByType.beforeVotingEnd += beforeVotingEnd.length

    const companyName = (companyNotifications[0].company as Company).name
    // Create email content
    const subject = `סיכום התראות אסיפות חברה - ${companyName}`
    companyDetail.companyName = companyName
    let html = `<div dir="rtl"><h1>שלום ${companyName},</h1>`
    html += '<h2>להלן סיכום התראות אסיפות חברה:</h2>'

    // Add after holding limit notifications
    if (afterHoldingLimit.length > 0) {
      html += '<h3>התראות יום אחרי מועד קובע:</h3><ul>'
      for (const notification of afterHoldingLimit) {
        html += `<li>${notification.message}</li>`
      }
      html += '</ul>'
    }

    // Add before voting end notifications
    if (beforeVotingEnd.length > 0) {
      html += '<h3>התראות יום לפני מועד מסירת הצבעות:</h3><ul>'
      for (const notification of beforeVotingEnd) {
        html += `<li>${notification.message}</li>`
      }
      html += '</ul>'
    }

    html += '<p>בברכה,<br>מערכת עמדה</p></div>'

    // Send the email
    try {
      await payload.sendEmail({
        from: process.env.EMAIL_FROM,
        to: usersMails,
        subject,
        html,
      })

      console.log(`Sent email to ${usersMails}`)
      results.emailsSent++
      companyDetail.emailStatus = 'sent'
    } catch (error) {
      console.error(`Error sending email to ${companyName}:`, error)
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
    // Call the core function
    const result = await sendCompanyMeetingNotifications(req)

    // Reschedule the task
    await scheduleSendCompanyMeetingNotificationsTask(req.payload)
    console.log('Rescheduled sendCompanyMeetingNotifications task')

    return {
      output: result,
    }
  } catch (error) {
    console.error('Error sending company meeting notifications:', error)
    return { output: { success: false, error } }
  }
}
