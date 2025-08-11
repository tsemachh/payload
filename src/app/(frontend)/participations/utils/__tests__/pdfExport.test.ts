import { groupDataByMeeting } from '../pdfExport'
import { ParticipationTableDataType } from '../../types'

// Mock data for testing
const mockParticipationData: ParticipationTableDataType[] = [
  {
    id: '1',
    stockNumber: 'STOCK001',
    stockName: 'Test Stock 1',
    marketValue: '1000000',
    percentageHolding: 5.5,
    holdingValueInMillions: 55,
    meetingDate: '2025-01-15',
    meetingType: 'רגילה',
    agendas: [
      {
        id: 'agenda1',
        topicIndex: 1,
        text: 'נושא ראשון',
        advisoryRecommendation: 'בעד',
        vote: 'בעד',
        simpleMajority: true,
        privilegedMajority: false,
        policyCompliance: true,
        conflictOfInterest: false,
        relatedParty: false,
        personalInterest: false,
        meetingResults: 'אושר'
      }
    ],
    meetingIdPayload: 'meeting1',
    meetingId: 'M001',
    companyName: 'Test Company',
    comments: '',
    committeeInitiated: false,
    companies: [],
    defaultVotingRecommendation: false,
    displayVotingRecommendation: false,
    electronicVotingEnabled: false,
    holdingsLimit: '',
    location: '',
    nominalValue: 0,
    proxyVotingDate: '',
    reference: '',
    researchDocuments: [],
    resultsConfirmationStatus: false,
    stockOrigin: '',
    stockSymbol: '',
    stockTradable: false,
    stockType: '',
    fundName: null,
    votingPercentage: null,
    currentCompany: { name: 'Current Company' },
    votes: null
  },
  {
    id: '2',
    stockNumber: 'STOCK002',
    stockName: 'Test Stock 2',
    marketValue: '2000000',
    percentageHolding: 3.2,
    holdingValueInMillions: 64,
    meetingDate: '2025-01-20',
    meetingType: 'מיוחדת',
    agendas: [
      {
        id: 'agenda2',
        topicIndex: 1,
        text: 'נושא שני',
        advisoryRecommendation: 'נגד',
        vote: 'נגד',
        simpleMajority: false,
        privilegedMajority: true,
        policyCompliance: false,
        conflictOfInterest: true,
        relatedParty: false,
        personalInterest: false,
        meetingResults: 'לא אושר'
      }
    ],
    meetingIdPayload: 'meeting2',
    meetingId: 'M002',
    companyName: 'Test Company 2',
    comments: '',
    committeeInitiated: false,
    companies: [],
    defaultVotingRecommendation: false,
    displayVotingRecommendation: false,
    electronicVotingEnabled: false,
    holdingsLimit: '',
    location: '',
    nominalValue: 0,
    proxyVotingDate: '',
    reference: '',
    researchDocuments: [],
    resultsConfirmationStatus: false,
    stockOrigin: '',
    stockSymbol: '',
    stockTradable: false,
    stockType: '',
    fundName: null,
    votingPercentage: null,
    currentCompany: { name: 'Current Company 2' },
    votes: null
  }
]

describe('groupDataByMeeting', () => {
  test('should group data by stockNumber correctly', () => {
    const result = groupDataByMeeting(mockParticipationData)
    
    expect(result).toHaveLength(2)
    expect(result[0].stockNumber).toBe('STOCK001')
    expect(result[1].stockNumber).toBe('STOCK002')
  })

  test('should preserve meeting data correctly', () => {
    const result = groupDataByMeeting(mockParticipationData)
    
    const firstMeeting = result[0]
    expect(firstMeeting.stockName).toBe('Test Stock 1')
    expect(firstMeeting.marketValue).toBe('1000000')
    expect(firstMeeting.percentageHolding).toBe(5.5)
    expect(firstMeeting.companyName).toBe('Current Company')
  })

  test('should include agendas in grouped data', () => {
    const result = groupDataByMeeting(mockParticipationData)
    
    expect(result[0].agendas).toHaveLength(1)
    expect(result[0].agendas[0].text).toBe('נושא ראשון')
    expect(result[1].agendas[0].text).toBe('נושא שני')
  })

  test('should handle empty data', () => {
    const result = groupDataByMeeting([])
    expect(result).toHaveLength(0)
  })

  test('should handle data without agendas', () => {
    const dataWithoutAgendas = [{
      ...mockParticipationData[0],
      agendas: []
    }]
    
    const result = groupDataByMeeting(dataWithoutAgendas)
    expect(result).toHaveLength(1)
    expect(result[0].agendas).toHaveLength(0)
  })
})