import  { Payload } from 'payload'

export const scheduleCheckNotificationsTask = async (payload: Payload): Promise<void> => {
  await payload.jobs.queue({
    task: 'checkNotifications',
    queue: 'daily',
    input: {  }
  })
}

export const scheduleProcessMeetingStateTask = async (payload: Payload): Promise<void> => {
  await payload.jobs.queue({
    task: 'processMeetingState',
    queue: 'daily',
    input: {  }
  })
}

export const scheduleDailyTasks = async (payload: Payload): Promise<void> => {
  try {
    await payload.delete({
      collection: 'payload-jobs',
      where:{
        taskSlug:{
          in: ['checkNotifications','processMeetingState']
        },
        totalTried:{
          equals : 0
        }
      }
    })
    // Schedule the checkNotifications task
    await scheduleCheckNotificationsTask(payload)
    // Schedule the processMeetingState task
    await scheduleProcessMeetingStateTask(payload)

    payload.logger.info('Daily tasks scheduled successfully')
  } catch (error) {
    payload.logger.error(`Error scheduling daily tasks: ${JSON.stringify(error)}`)
  }
}
