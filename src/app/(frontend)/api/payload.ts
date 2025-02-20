import { getPayload } from 'payload'
import 'dotenv/config'
import config from '@/payload.config'
import { FutureMeetingTableData, StatusType } from '../types'

export async function fetchMeetingsForTable() {
  const payload = await getPayload({ config })
  const meetings = await payload.find({ collection: 'meetings' })

  return meetings.docs.map((meeting): FutureMeetingTableData => {
    let stockPresent
    // let meetingTypePresent
    if (typeof meeting.stock === 'object') stockPresent = meeting.stock
    // if (typeof meeting.meetingType === 'object') meetingTypePresent = meeting.meetingType

    return {
      meetingId: meeting.id,
      stockNumber: stockPresent?.stockId?.toString() || '',
      stockType: stockPresent?.type || '',
      companyName: stockPresent?.name || '',
      // marketValue: stockPresent?.marketValue || 0,
      marketValue: 0,
      // meetingType: meetingTypePresent?.name || '',//TODO: docker build
      meetingType: 'מיוחדת',
      meetingDate: meeting.meetingDate?.split('T')[0] || '',
      location: meeting.location || '',
      holdingsLimit: meeting.holdingsLimit?.split('T')[0] || '',
      // proxyVotingDate: meeting.proxyStatementDate?.split('T')[0] || '',
      proxyVotingDate: '',
      // votingDocUrl: meeting.votingDocUrl || '',
      votingDocUrl: '',
      // meetingInviteUrl: meeting.meetingInviteUrl || '',
      meetingInviteUrl: '',
      comments: meeting.comments || '',
      electronicVotingEnabled: !!meeting.electronicVotingEnabled,
      resultsConfirmationStatus: !!meeting.resultsConfirmationStatus,
      relatedMeetingId: false,
      // relatedMeetingId: !!meeting.relatedMeetingId,
      committeeInitiated: !!meeting.committeeInitiated,
      _status: meeting._status ? (meeting._status as StatusType) : StatusType.None,
    }
  })
}
