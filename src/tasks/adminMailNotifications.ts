import type { TaskHandler } from 'payload'
import { PayloadRequest } from 'payload'
import { sanitizeRequest } from './utils'
import { scheduleAdminMailNotificationsTask } from '@/tasks/scheduleDailyTasks'
import { isHolidayOrShabbat } from '../collections/meetings/hooks/calculateHoldingDate'

/**
 * Core function to send admin mail notifications
 * This function contains the core logic for sending admin mail notifications
 * It is used by both the task handler and the endpoint
 */
export const adminMailNotifications = async (req: PayloadRequest) => {
  try {
    const emailsSent = {
      count: 0,
    }

    if (isHolidayOrShabbat(new Date())) {
      return {
        success: true,
        message: 'non working day',
      }
    }

    // Calculate date 24 hours ago
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString()

    // Find all unread admin notifications created in the last 24 hours
    const { docs: unreadNotifications } = await req.payload.find({
      collection: 'admin-notifications',
      where: {
        handled: {
          equals: false,
        },
        createdAt: {
          greater_than_equal: twentyFourHoursAgoISO,
        },
      },
      limit: 0,
    })

    if (unreadNotifications.length === 0) {
      return {
        success: true,
        message: 'No unread notifications to send',
        emailsSent,
      }
    }

    // Find admin users to send notifications to
    const { docs: adminUsers } = await req.payload.find({
      collection: 'users',
      where: {
        isAdmin: {
          equals: true,
        },
      },
      limit: 0,
    })

    if (adminUsers.length === 0) {
      return {
        success: false,
        message: 'No admin users found to send notifications to',
      }
    }

    // Group notifications by type
    const holdingsNotifications = unreadNotifications.filter((notification) =>
      notification.message.includes('לא דיווחה על החזקות'),
    )

    const meetingsNotifications = unreadNotifications.filter((notification) =>
      notification.message.includes('לא הצביעה באסיפה'),
    )

    const feedNotifications = unreadNotifications.filter((notification) =>
      notification.message.includes('לא התקבל פיד'),
    )

    const otherNotifications = unreadNotifications.filter(
      (notification) =>
        !notification.message.includes('לא דיווחה על החזקות') &&
        !notification.message.includes('לא הצביעה באסיפה') &&
        !notification.message.includes('לא התקבל פיד'),
    )

    // Create email content
    const emailSubject = `עמדה - התראות מערכת ב-24 השעות האחרונות (${unreadNotifications.length})`
    let emailContent = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      direction: rtl;
      text-align: right;
      font-family: Arial, sans-serif;
    }
    h1, h2, p, ul, li {
      text-align: right;
    }
  </style>
</head>
<body>
  <h1>התראות מערכת</h1>
  <p>להלן רשימת ההתראות שנוצרו ב-24 השעות האחרונות וטרם נקראו במערכת:</p>
`

    if (holdingsNotifications.length > 0) {
      emailContent += `<h2>התראות החזקות (${holdingsNotifications.length})</h2><ul>`
      holdingsNotifications.forEach((notification) => {
        emailContent += `<li><a href="${req.payload.config.serverURL}/admin/collections/admin-notifications/${notification.id}">${notification.message}</a></li>`
      })
      emailContent += `</ul>`
    }

    if (meetingsNotifications.length > 0) {
      emailContent += `<h2>התראות אסיפות (${meetingsNotifications.length})</h2><ul>`
      meetingsNotifications.forEach((notification) => {
        emailContent += `<li><a href="${req.payload.config.serverURL}/admin/collections/admin-notifications/${notification.id}">${notification.message}</a></li>`
      })
      emailContent += `</ul>`
    }

    if (feedNotifications.length > 0) {
      emailContent += `<h2>התראות פידים (${feedNotifications.length})</h2><ul>`
      feedNotifications.forEach((notification) => {
        emailContent += `<li><a href="${req.payload.config.serverURL}/admin/collections/admin-notifications/${notification.id}">${notification.message}</a></li>`
      })
      emailContent += `</ul>`
    }

    if (otherNotifications.length > 0) {
      emailContent += `<h2>התראות אחרות (${otherNotifications.length})</h2><ul>`
      otherNotifications.forEach((notification) => {
        emailContent += `<li><a href="${req.payload.config.serverURL}/admin/collections/admin-notifications/${notification.id}">${notification.message}</a></li>`
      })
      emailContent += `</ul>`
    }

    emailContent += `<p>לצפייה בכל ההתראות, <a href="${req.payload.config.serverURL}/admin/collections/admin-notifications">לחץ כאן</a>.</p>
</body>
</html>`

    // Send email to each admin user
    try {
      await req.payload.sendEmail({
        to: adminUsers.map((user) => user.email),
        subject: emailSubject,
        html: emailContent,
      })
      emailsSent.count++
    } catch (error) {
      req.payload.logger.error(`Error sending email to Admin users: ${JSON.stringify(error)}`)
    }

    // Purge old read notifications (older than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

    try {
      const { docs } = await req.payload.delete({
        collection: 'admin-notifications',
        where: {
          handled: {
            equals: true,
          },
          createdAt: {
            less_than: thirtyDaysAgoISO,
          },
        },
      })

      req.payload.logger.info(`Purged ${docs.length} old read notifications`)

      return {
        success: true,
        message: `Sent ${emailsSent.count} emails with ${unreadNotifications.length} notifications. Purged ${docs.length} old read notifications.`,
        emailsSent,
        purgedNotifications: docs.length,
      }
    } catch (purgeError) {
      req.payload.logger.error(`Error purging old notifications: ${JSON.stringify(purgeError)}`)

      return {
        success: true,
        message: `Sent ${emailsSent.count} emails with ${unreadNotifications.length} notifications. Failed to purge old notifications.`,
        emailsSent,
      }
    }
  } catch (error) {
    req.payload.logger.error(`Error sending admin mail notifications: ${JSON.stringify(error)}`)
    return {
      success: false,
      error: 'Failed to send admin mail notifications',
      details: error,
    }
  }
}

export const adminMailNotificationsHandler: TaskHandler<'adminMailNotifications'> = async ({
  job,
  req,
}) => {
  try {
    console.log('adminMailNotificationsHandler', job)
    await sanitizeRequest(req, 'adminMailNotificationsHandler')

    // Call the core function
    const result = await adminMailNotifications(req)

    // Reschedule the task
    await scheduleAdminMailNotificationsTask(req.payload)
    console.log('adminMailNotificationsHandler result:', result)

    return {
      output: result,
    }
  } catch (error) {
    req.payload.logger.error(`Error in adminMailNotifications task: ${JSON.stringify(error)}`)
    throw error
  }
}
