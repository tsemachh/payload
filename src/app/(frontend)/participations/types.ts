// Define the data type for a single agenda item within a participation
export interface ParticipationAgendaType {
  id: string
  topicIndex: number
  text: string
  advisoryRecommendation: string // "המלצת גורם מייעץ"
  vote: string // "הצבעה"
  simpleMajority: boolean
  privilegedMajority: boolean // Assuming this is "רוב מיוחד"
  policyCompliance: boolean
  conflictOfInterest: boolean
  relatedParty: boolean
  personalInterest: boolean
  meetingResults: string // "תוצאות האסיפה" for agenda item
  recommendation: any
  result: string
  percentResult: number
}

// Update ParticipationTableDataType - remove fields that are now in ParticipationAgendaType
export interface ParticipationTableDataType {
  id: string // This will be mapped from meetingIdPayload for table's internal use
  stockNumber: string
  corporateName: string
  stockName: string
  marketValue: string // Changed from number to string
  percentageHolding: number
  holdingValueInMillions: number // Assuming this is a number after parsing
  meetingDate: string
  meetingType: string
  agendas: ParticipationAgendaType[]

  // Meeting details
  meetingIdPayload: string // The actual unique ID from the API
  meetingId: string // The meeting ID from the API
  companyName: string
  comments: string
  committeeInitiated: boolean
  companies: Array<{ id: string; name: string }>
  defaultVotingRecommendation: boolean
  displayVotingRecommendation: boolean
  electronicVotingEnabled: boolean
  holdingsLimit: string
  location: string
  nominalValue: number
  proxyVotingDate: string
  reference: string
  researchDocuments: any[] // Adjust type if known
  resultsConfirmationStatus: boolean

  // Stock details
  stockOrigin: string
  stockSymbol: string
  stockTradable: boolean
  stockType: string

  // Company and voting details
  fundName: string | null
  votingPercentage: number | null
  currentCompany: {
    id: string
    name: string
  }
  votes: any[] // Consider creating a more specific type
}
