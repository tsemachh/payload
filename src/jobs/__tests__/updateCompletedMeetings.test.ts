// import { Payload } from 'payload'
// import { PayloadRequest } from 'payload'
// import { updateCompletedMeetings } from '../updateCompletedMeetings'
// import { jest } from '@jest/globals'

// describe('updateCompletedMeetings', () => {
//   let payload: Payload
//   let mockReq: PayloadRequest

//   beforeAll(async () => {
//     payload = await import('payload').then((module) => module.default)

//     mockReq = {
//       payload,
//       user: undefined,
//       payloadAPI: 'local',
//       files: undefined,
//       locale: undefined,
//       fallbackLocale: undefined,
//       collection: undefined,
//       doc: undefined,
//     } as PayloadRequest

//     // Mock logger to prevent real logging
//     jest.spyOn(mockReq.payload.logger, 'info').mockImplementation(() => {})
//     jest.spyOn(mockReq.payload.logger, 'error').mockImplementation(() => {})
//   })

//   beforeEach(async () => {
//     // Clean up all meetings before each test
//     await payload.delete({
//       collection: 'meetings',
//       where: {},
//     })
//   })

//   afterEach(() => {
//     jest.restoreAllMocks()
//   })

//   it('should update past scheduled meetings to completed', async () => {
//     const pastDate = new Date()
//     pastDate.setDate(pastDate.getDate() - 1) // Yesterday

//     const meeting = await payload.create({
//       collection: 'meetings',
//       data: {
//         meetingId: Math.floor(Math.random() * 1000000),
//         meetingDate: pastDate.toISOString(),
//         state: 'scheduled',
//       },
//     })

//     const result = await updateCompletedMeetings({
//       req: mockReq,
//       job: {},
//       input: {},
//     })

//     const updatedMeeting = await payload.findByID({
//       collection: 'meetings',
//       id: meeting.id,
//     })

//     expect(updatedMeeting.state).toBe('completed')
//     expect(result.updatedCount).toBe(1)
//   })

//   it('should not update future scheduled meetings', async () => {
//     const futureDate = new Date()
//     futureDate.setDate(futureDate.getDate() + 1) // Tomorrow

//     const meeting = await payload.create({
//       collection: 'meetings',
//       data: {
//         meetingId: Math.floor(Math.random() * 1000000),
//         meetingDate: futureDate.toISOString(),
//         state: 'scheduled',
//       },
//     })

//     const result = await updateCompletedMeetings({
//       req: mockReq,
//       job: {},
//       input: {},
//     })

//     const updatedMeeting = await payload.findByID({
//       collection: 'meetings',
//       id: meeting.id,
//     })

//     expect(updatedMeeting.state).toBe('scheduled')
//     expect(result.updatedCount).toBe(0)
//   })

//   it('should handle errors properly', async () => {
//     const findSpy = jest
//       .spyOn(mockReq.payload, 'find')
//       .mockRejectedValue(new Error('Database error'))

//     await expect(
//       updateCompletedMeetings({
//         req: mockReq,
//         job: {},
//         input: {},
//       }),
//     ).rejects.toThrow('Database error')

//     expect(findSpy).toHaveBeenCalledTimes(1)
//   })
// })
