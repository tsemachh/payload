export type Assembly = {
  id: string
  accountNumber: string
  securityNumber: string
  securityType: string
  companyName: string
  marketValue: number
  assemblyType: string
  recordDate: string
  recordTime: string
  votingSubmissionDate: string
  votingSubmissionTime: string
  assemblyDate: string
  assemblyTime: string
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
  assemblyInvitation: {
    exists: boolean
    viewed: boolean
  }
  votingReceived: boolean
  inElectronicSystem: boolean
  requiresFinancialCommittee: boolean
  location: string
}

