import { getPayload } from 'payload'
import 'dotenv/config'
import config from '@/payload.config'
import { FutureMeetingTableData, StatusType } from '../types'

export async function fetchMeetingsForTable() {
  const payload = await getPayload({ config })
  const meetings = await payload.find({ collection: 'meetings' })

  return meetings.docs.map((meeting): FutureMeetingTableData => {
    let stockPresent
    let meetingTypePresent
    if (typeof meeting.stock === 'object') stockPresent = meeting.stock
    if (typeof meeting.meetingType === 'object') meetingTypePresent = meeting.meetingType

    return {
      meetingId: meeting.id,
      stockNumber: stockPresent?.stockID?.toString() || '',
      stockType: stockPresent?.type || '',
      companyName: stockPresent?.name || '',
      marketValue: stockPresent?.marketValue || 0,
      meetingType: meetingTypePresent?.name || '',
      meetingDate: meeting.meetingDate?.split('T')[0] || '',
      location: meeting.location || '',
      holdingsLimit: meeting.holdingsLimit?.split('T')[0] || '',
      proxyVotingDate: meeting.proxyStatementDate?.split('T')[0] || '',
      votingDocUrl: meeting.votingDocUrl ? meeting.votingDocUrl : '',
      meetingInviteUrl: meeting.meetingInviteUrl ? meeting.meetingInviteUrl : '',
      comments: meeting.comments ? meeting.comments : '',
      electronicVotingEnabled: !!meeting.electronicVotingEnabled,
      resultsConfirmationStatus: !!meeting.resultsConfirmationStatus,
      relatedMeetingId: !!meeting.relatedMeetingId,
      committeeInitiated: !!meeting.committeeInitiated,
      _status: meeting._status ? (meeting._status as StatusType) : StatusType.None,
    }
  })
}
