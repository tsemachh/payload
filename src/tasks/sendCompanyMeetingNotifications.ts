import { type TaskHandler } from 'payload'
import { Company } from '@/payload-types'

/**
 * Sends daily email notifications to users who have opted in to receive them.
 * Groups notifications by user and sends a summary email.
 */
export const sendCompanyMeetingNotificationsHandler: TaskHandler<
  'sendCompanyMeetingNotifications'
> = async ({ req }) => {
  try {
    const payload = req.payload
    console.log('Starting company meeting notifications email sending...')
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

    if (notifications.docs.length === 0) {
      return { output: { success: true, message: 'No notifications to send' } }
    }

    // Group notifications by user
    const { docs: users } = await payload.find({
      collection: 'users',
      select: {
        id: true,
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
    users.forEach((user) => {
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
      const companyNotifications = notifications.docs.filter((notification) => {
        return (notification?.company as Company)?.id === companyId
      })
      // Skip if no notifications for this user
      if (companyNotifications.length === 0) {
        continue
      }

      // Create email content
      const subject = `סיכום התראות אסיפות חברה - {companyName}$`

      // Group notifications by type
      const afterHoldingLimit = companyNotifications.filter(
        (n) => n.notificationType === 'after-holding-limit',
      )
      const beforeVotingEnd = companyNotifications.filter(
        (n) => n.notificationType === 'before-voting-end',
      )

      const companyName = (companyNotifications[0].company as Company).name
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
      } catch (error) {
        console.error(`Error sending email to ${companyName}:`, error)
      }
    }

    console.log('Company meeting notifications email sending completed')
    return { output: { success: true } }
  } catch (error) {
    console.error('Error sending company meeting notifications:', error)
    return { output: { success: false, error } }
  }
}
