import { Payload } from 'payload'
import { safeScheduleTask } from './safeScheduleTask'

export const scheduleCheckAdminNotificationsTask = async (payload: Payload): Promise<void> => {
  await safeScheduleTask(payload, 'checkAdminNotifications', 'daily07pm')
}

export const scheduleProcessMeetingStateTask = async (payload: Payload): Promise<void> => {
  await safeScheduleTask(payload, 'processMeetingState', 'daily07pm')
}

export const scheduleAdminMailNotificationsTask = async (payload: Payload): Promise<void> => {
  await safeScheduleTask(payload, 'adminMailNotifications', 'daily10pm')
}

export const scheduleCheckCompanyNotificationsTask = async (payload: Payload): Promise<void> => {
  await safeScheduleTask(payload, 'checkCompanyNotifications', 'daily07pm')
}

export const scheduleSendCompanyMeetingNotificationsTask = async (
  payload: Payload,
): Promise<void> => {
  await safeScheduleTask(payload, 'sendCompanyMeetingNotifications', 'daily08am')
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
  await safeScheduleTask(payload, 'sendDailyMeetingNotifications', 'daily08am', input)
  // Log the scheduling with agenda update information (input is ignored for safety)
  payload.logger.info({
    agendaUpdatesCount: agendaUpdatedMeetingIds?.length || 0,
    agendaUpdatedMeetingIds: agendaUpdatedMeetingIds || [],
  }, 'Scheduled daily meeting notifications task (safe)')
}

export const scheduleDailyTasks = async (payload: Payload): Promise<void> => {
  try {
    // Each helper performs its own safe dedupe before enqueueing
    await scheduleCheckAdminNotificationsTask(payload)
    await scheduleProcessMeetingStateTask(payload)
    await scheduleAdminMailNotificationsTask(payload)
    await scheduleCheckCompanyNotificationsTask(payload)
    await scheduleSendCompanyMeetingNotificationsTask(payload)
    await scheduleSendDailyMeetingNotificationsTask(payload)

    payload.logger.info('Daily tasks scheduled successfully (safe)')
  } catch (error) {
    payload.logger.error(`Error scheduling daily tasks: ${JSON.stringify(error)}`)
  }
}
