# Meeting State Update CRON Job

This job automatically updates the state of scheduled meetings to 'completed' when their scheduled date has passed.

## Implementation Details

The job is implemented in `updateCompletedMeetings.ts` and consists of two main components:

1. **Job Configuration** (in `payload.config.ts`):
```typescript
jobs: {
  tasks: [updateCompletedMeetings],
  autoRun: [
    {
      cron: '0 0 * * *', // Runs every day at midnight
      limit: 100,
      queue: 'daily',
    },
  ],
  shouldAutoRun: async () => true,
}
```

2. **Job Implementation** (in `updateCompletedMeetings.ts`):
```typescript
type UpdateCompletedMeetingsResult = {
  updatedCount: number
}

export const updateCompletedMeetings: Task = {
  name: 'updateCompletedMeetings',
  run: async ({ payload }: { payload: Payload }): Promise<UpdateCompletedMeetingsResult> => {
    try {
      const now = new Date().toISOString()

      // Find all scheduled meetings with past dates
      const { docs: meetings } = await payload.find({
        collection: 'meetings',
        where: {
          meetingDate: { less_than: now },
          state: { equals: 'scheduled' },
        },
      })

      // Update their state to 'completed'
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
        return { updatedCount: meetings.length }
      }

      payload.logger.info('No meetings to update')
      return { updatedCount: 0 }
    } catch (error) {
      payload.logger.error(`Error updating completed meetings: ${error.message}`)
      throw error
    }
  },
}
```

## How It Works

1. The job runs automatically every day at midnight
2. It queries the database for all meetings that:
   - Have a `state` of 'scheduled'
   - Have a `meetingDate` that is earlier than the current time
3. For each matching meeting, it updates the `state` to 'completed'
4. The job processes up to 100 meetings per run (configurable via the `limit` parameter)

## Manual Testing

To verify the job is working correctly:

1. Create a test meeting with a past date:
```typescript
await payload.create({
  collection: 'meetings',
  data: {
    meetingId: 12345,
    meetingDate: '2024-01-01T10:00:00.000Z', // Past date
    state: 'scheduled',
  },
})
```

2. Manually trigger the job:
```typescript
const result = await updateCompletedMeetings.run({ payload })
console.log(`Updated ${result.updatedCount} meetings`)
```

3. Verify the meeting state:
```typescript
const meeting = await payload.find({
  collection: 'meetings',
  where: {
    meetingId: { equals: 12345 },
  },
})
console.log(meeting.docs[0].state) // Should be 'completed'
```

## Logging

The job includes logging to track its execution:
- Logs the number of meetings updated in each run
- Logs when no meetings need updating
- Uses Payload's built-in logger for consistent logging format

## Performance Considerations

- Uses `Promise.all` for efficient batch processing
- Includes a limit of 100 meetings per run to prevent overload
- Uses Payload's built-in database methods for optimal performance
- Indexes are automatically created on the `meetingDate` and `state` fields
