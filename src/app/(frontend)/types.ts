export type FutureMeetingTableData = {
  id: string
  accountNumber: string
  securityNumber: string
  securityType: string
  companyName: string
  marketValue: number
  meetingType: string
  proxyStatementDate: string
  proxyStatementTime: string
  votingSubmissionDate: string
  votingSubmissionTime: string
  meetingDate: string
  meetingTime: string
  holdingPercentage: number
  holdingValue: number
  opinion: {
    exists: boolean
    viewed: boolean
  }
  votingPaper: {
    exists: boolean
    viewed: boolean
  }
  meetingInvitation: {
    exists: boolean
    viewed: boolean
  }
  votingReceived: boolean
  inElectronicSystem: boolean
  requiresFinancialCommittee: boolean
  location: string
}
