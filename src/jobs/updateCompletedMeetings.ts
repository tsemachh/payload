import { Payload, TaskConfig } from 'payload'

export const updateCompletedMeetings: TaskConfig = {
  name: 'updateCompletedMeetings',
  handler: async (payload: Payload) => {
    // Change `run` to `handler`
    const now = new Date().toISOString()

    const { docs: meetings } = await payload.find({
      collection: 'meetings',
      where: {
        meetingDate: { less_than: now },
        state: { equals: 'scheduled' },
      },
    })

    if (meetings.length > 0) {
      await Promise.all(
        meetings.map((meeting) =>
          payload.update({
            collection: 'meetings',
            id: meeting.id,
            data: { state: 'completed' },
          }),
        ),
      )
      payload.logger.info(`Updated ${meetings.length} meetings to 'completed'`)
    } else {
      payload.logger.info('No meetings to update')
    }
  },
}
