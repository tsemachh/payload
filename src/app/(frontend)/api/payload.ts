import { getPayload } from 'payload'
import 'dotenv/config'
import config from '@/payload.config'
import { FutureMeetingTableData, StatusType } from '../types'

export async function fetchMeetingsForTable() {
  const payload = await getPayload({ config })
  const meetings = await payload.find({ collection: 'meetings', limit: 200 })

  return meetings.docs.map((meeting): FutureMeetingTableData => {
    let stockPresent
    if (typeof meeting.stock === 'object') stockPresent = meeting.stock

    return {
      meetingId: meeting.meetingId,
      stockNumber: stockPresent?.stockId?.toString() || '',
      stockType: stockPresent?.type || '',
      companyName: stockPresent?.name || '',
      // marketValue: stockPresent?.marketValue || 0,
      meetingType: meeting.type || '',
      meetingDate: meeting.meetingDate?.split('T')[0] || '',
      location: meeting.location || '',
      holdingsLimit: meeting.holdingsLimit?.split('T')[0] || '',
      proxyVotingDate: meeting.proxyVotingDate?.split('T')[0] || '',
      // votingDocUrl: meeting.votingDocUrl || '',
      // meetingInviteUrl: meeting.meetingInviteUrl || '',
      meetingInviteUrl: 'https://github.com/orgs/shefing/projects/3/views/1',
      comments: meeting.comments || '',
      electronicVotingEnabled: !!meeting.electronicVotingEnabled,
      resultsConfirmationStatus: !!meeting.resultsConfirmationStatus,
      committeeInitiated: !!meeting.committeeInitiated,
      _status: meeting._status ? (meeting._status as StatusType) : StatusType.None,
    }
  })
}
