import { PayloadRequest } from 'payload'

/**
 * Endpoint to send email notifications for admin notifications
 * This endpoint will:
 * 1. Find all unread admin notifications
 * 2. Group them by related user (if any)
 * 3. Send an email to admin users with a summary of notifications
 */
const SendAdminMailNotificationsEndpoint = async (req: PayloadRequest) => {
  try {
    // Authentication check
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    const emailsSent = {
      count: 0,
    }

    // Find all unread admin notifications
    const { docs: unreadNotifications } = await req.payload.find({
      collection: 'admin-notifications',
      where: {
        readStatus: {
          equals: false,
        },
      },
      limit: 0,
    })

    if (unreadNotifications.length === 0) {
      return Response.json({
        success: true,
        message: 'No unread notifications to send',
        emailsSent,
      })
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
      return Response.json({
        success: false,
        message: 'No admin users found to send notifications to',
      })
    }

    // Group notifications by type
    const holdingsNotifications = unreadNotifications.filter((notification) =>
      notification.message.includes('לא דיווחה על אחזקות'),
    )

    const meetingsNotifications = unreadNotifications.filter((notification) =>
      notification.message.includes('לא הצביעה באסיפה'),
    )

    const feedNotifications = unreadNotifications.filter((notification) =>
      notification.message.includes('לא התקבל פיד'),
    )

    const otherNotifications = unreadNotifications.filter(
      (notification) =>
        !notification.message.includes('לא דיווחה על אחזקות') &&
        !notification.message.includes('לא הצביעה באסיפה') &&
        !notification.message.includes('לא התקבל פיד'),
    )

    // Create email content
    const emailSubject = `עמדה - התראות מערכת (${unreadNotifications.length})`
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
  <p>להלן רשימת ההתראות שטרם נקראו במערכת:</p>
`

    if (holdingsNotifications.length > 0) {
      emailContent += `<h2>התראות אחזקות (${holdingsNotifications.length})</h2><ul>`
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
    for (const user of adminUsers) {
      if (user.email) {
        try {
          await req.payload.sendEmail({
            to: user.email,
            subject: emailSubject,
            html: emailContent,
          })
          emailsSent.count++
        } catch (error) {
          req.payload.logger.error(`Error sending email to ${user.email}: ${JSON.stringify(error)}`)
        }
      }
    }

    return Response.json({
      success: true,
      message: `Sent ${emailsSent.count} emails with ${unreadNotifications.length} notifications`,
      emailsSent,
    })
  } catch (error) {
    req.payload.logger.error(`Error sending admin mail notifications: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to send admin mail notifications',
        details: error,
      },
      { status: 500 },
    )
  }
}

export default SendAdminMailNotificationsEndpoint
