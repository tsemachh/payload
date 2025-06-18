import { Payload } from 'payload'

export const scheduleCheckNotificationsTask = async (payload: Payload): Promise<void> => {
  await payload.jobs.queue({
    task: 'checkNotifications',
    queue: 'daily',
    input: {},
  })
}

export const scheduleProcessMeetingStateTask = async (payload: Payload): Promise<void> => {
  await payload.jobs.queue({
    task: 'processMeetingState',
    queue: 'daily',
    input: {},
  })
}

export const scheduleAdminMailNotificationsTask = async (payload: Payload): Promise<void> => {
  await payload.jobs.queue({
    task: 'adminMailNotifications',
    queue: 'daily10pm',
    input: {},
  })
}

export const scheduleCheckCompanyMeetingNotificationsTask = async (
  payload: Payload,
): Promise<void> => {
  await payload.jobs.queue({
    task: 'checkCompanyMeetingNotifications',
    queue: 'daily',
    input: {},
  })
}

export const scheduleSendCompanyMeetingNotificationsTask = async (
  payload: Payload,
): Promise<void> => {
  await payload.jobs.queue({
    task: 'sendCompanyMeetingNotifications',
    queue: 'daily10pm',
    input: {},
  })
}

export const scheduleDailyTasks = async (payload: Payload): Promise<void> => {
  try {
    await payload.delete({
      collection: 'payload-jobs',
      where: {
        taskSlug: {
          in: [
            'checkNotifications',
            'processMeetingState',
            'adminMailNotifications',
            'checkCompanyMeetingNotifications',
            'sendCompanyMeetingNotifications',
          ],
        },
        totalTried: {
          equals: 0,
        },
      },
    })
    // Schedule the checkNotifications task
    await scheduleCheckNotificationsTask(payload)
    // Schedule the processMeetingState task
    await scheduleProcessMeetingStateTask(payload)
    // Schedule the adminMailNotifications task
    await scheduleAdminMailNotificationsTask(payload)
    // Schedule the checkCompanyMeetingNotifications task
    await scheduleCheckCompanyMeetingNotificationsTask(payload)
    // Schedule the sendCompanyMeetingNotifications task
    await scheduleSendCompanyMeetingNotificationsTask(payload)

    payload.logger.info('Daily tasks scheduled successfully')
  } catch (error) {
    payload.logger.error(`Error scheduling daily tasks: ${JSON.stringify(error)}`)
  }
}
