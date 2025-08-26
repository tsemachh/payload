import { Payload } from 'payload'

export const scheduleCheckAdminNotificationsTask = async (payload: Payload): Promise<void> => {
  await payload.jobs.queue({
    task: 'checkAdminNotifications',
    queue: 'daily07pm',
    input: {},
  })
}

export const scheduleProcessMeetingStateTask = async (payload: Payload): Promise<void> => {
  await payload.jobs.queue({
    task: 'processMeetingState',
    queue: 'daily07pm',
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

export const scheduleCheckCompanyNotificationsTask = async (payload: Payload): Promise<void> => {
  await payload.jobs.queue({
    task: 'checkCompanyNotifications',
    queue: 'daily07pm',
    input: {},
  })
}

export const scheduleSendCompanyMeetingNotificationsTask = async (
  payload: Payload,
): Promise<void> => {
  await payload.jobs.queue({
    task: 'sendCompanyMeetingNotifications',
    queue: 'daily08am',
    input: {},
  })
}

export const scheduleSendDailyMeetingNotificationsTask = async (
  payload: Payload,
  agendaUpdatedMeetingIds?: string[],
): Promise<void> => {
  // Prepare input with agenda update data if provided, otherwise empty array (0 count)
  const input = {
    agendaUpdatedMeetingIds: agendaUpdatedMeetingIds
      ? agendaUpdatedMeetingIds.map((id) => ({ id }))
      : [],
  }

  await payload.jobs.queue({
    task: 'sendDailyMeetingNotifications',
    queue: 'daily08am',
    input,
  })

  // Log the scheduling with agenda update information
  payload.logger.info('Scheduled daily meeting notifications task', {
    agendaUpdatesCount: agendaUpdatedMeetingIds?.length || 0,
    agendaUpdatedMeetingIds: agendaUpdatedMeetingIds || [],
  })
}

export const scheduleDailyTasks = async (payload: Payload): Promise<void> => {
  try {
    await payload.delete({
      collection: 'payload-jobs',
      where: {
        taskSlug: {
          in: [
            'checkAdminNotifications',
            'processMeetingState',
            'adminMailNotifications',
            'checkCompanyNotifications',
            'sendCompanyMeetingNotifications',
            'sendDailyMeetingNotifications',
          ],
        },
        totalTried: {
          equals: 0,
        },
      },
    })
    // Schedule the checkAdminNotifications task
    await scheduleCheckAdminNotificationsTask(payload)
    // Schedule the processMeetingState task
    await scheduleProcessMeetingStateTask(payload)
    // Schedule the adminMailNotifications task
    await scheduleAdminMailNotificationsTask(payload)
    // Schedule the checkCompanyNotifications task
    await scheduleCheckCompanyNotificationsTask(payload)
    // Schedule the sendCompanyMeetingNotifications task
    await scheduleSendCompanyMeetingNotificationsTask(payload)
    // Schedule the sendDailyMeetingNotifications task
    await scheduleSendDailyMeetingNotificationsTask(payload)

    payload.logger.info('Daily tasks scheduled successfully')
  } catch (error) {
    payload.logger.error(`Error scheduling daily tasks: ${JSON.stringify(error)}`)
  }
}
