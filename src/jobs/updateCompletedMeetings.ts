import { Meeting } from '@/payload-types'
import { Console } from 'console'

type UpdateCompletedMeetingsResult = {
  updatedCount: number
}

export const updateCompletedMeetings: ({
  input,
  job,
  req,
}: {
  input: any
  job: any
  req: any
}) => Promise<UpdateCompletedMeetingsResult> = async ({ input, job, req }) => {
  try {
    console.log('aaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    console.log('aaaaaaaaaaaaaaafaaaaaaaaaaaaa')

    req.payload.logger.info('Job is running at 11:00 AM!')

    const now = new Date().toISOString()

    const { docs: meetings } = await req.payload.find({
      collection: 'meetings',
      where: {
        meetingDate: { less_than: now },
        state: { equals: 'scheduled' },
      },
    })

    if (meetings.length > 0) {
      await Promise.all(
        meetings.map((meeting: Meeting) =>
          req.payload.update({
            collection: 'meetings',
            id: meeting.id,
            data: { state: 'completed' },
          }),
        ),
      )
      req.payload.logger.info(`Updated ${meetings.length} meetings to 'completed'`)
      return { updatedCount: meetings.length } as UpdateCompletedMeetingsResult
    }

    req.payload.logger.info('No meetings to update')
    return { updatedCount: meetings.length }
  } catch (error) {
    req.payload.logger.error(`Error updating completed meetings: ${JSON.stringify(error)}`)
    throw error
  }
}
