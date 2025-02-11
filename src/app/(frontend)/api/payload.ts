import { getPayload } from 'payload'
import 'dotenv/config'
import config from '@/payload.config'
import { FutureMeetingTableData } from '../types'

export async function fetchMeetingsForTable() {
  const payload = await getPayload({ config })
  const meetings = await payload.find({ collection: 'meetings' })

  return meetings.docs.map((meeting): FutureMeetingTableData => {
    let stockPresent
    let meetingTypePresent
    if (typeof meeting.stock === 'object') stockPresent = meeting.stock
    if (typeof meeting.meetingType === 'object') meetingTypePresent = meeting.meetingType

    return {
      id: meeting.id,
      accountNumber: "123456", // TODO
      securityNumber: stockPresent?.stockID?.toString() || '',
      securityType: stockPresent?.type || '',
      companyName: stockPresent?.name || '',
      marketValue: stockPresent?.marketValue || 0,
      meetingType: meetingTypePresent?.name || '',
      proxyStatementDate: meeting.holdingsLimit?.split('T')[0] || '',
      proxyStatementTime: meeting.holdingsLimit?.split('T')[1]?.split('.')[0] || '',
      votingSubmissionDate: meeting.proxyStatementDate?.split('T')[0] || '',
      votingSubmissionTime: meeting.proxyStatementDate?.split('T')[1]?.split('.')[0] || '',
      meetingDate: meeting.meetingDate?.split('T')[0] || '',
      meetingTime: meeting.meetingDate?.split('T')[1]?.split('.')[0] || '',
      holdingPercentage: 0, // TODO
      holdingValue: 0, // TODO
      opinion: {
        exists: false, // TODO
        viewed: false, // TODO
      },
      votingPaper: {
        exists: !!meeting.votingDocUrl,
        viewed: false, // TODO
      },
      meetingInvitation: {
        exists: !!meeting.meetingInviteUrl,
        viewed: false, // TODO
      },
      votingReceived: false, // TODO
      inElectronicSystem: !!meeting.electronicVotingEnabled,
      requiresFinancialCommittee: !!meeting.committeeInitiated,
      location: meeting.location || '',
    }
  })
}
