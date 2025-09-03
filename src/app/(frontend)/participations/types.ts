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
  // Removed from here: meetingResults, simpleMajority, specialMajority, policyCompliance, conflictOfInterest, relatedParty, personalInterest
  agendas: ParticipationAgendaType[]
  // Other fields from your API response
  meetingIdPayload: string // The actual unique ID from the API
  meetingId: string // The meeting ID from the API
  companyName: string
  comments: string
  committeeInitiated: boolean
  companies: { id: string; name: string }[] // Assuming this structure
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
  stockOrigin: string
  stockSymbol: string
  stockTradable: boolean
  stockType: string
  fundName: string | null // Assuming this is a string or null
  votingPercentage: number | null
  currentCompany: any
  votes: any
}
