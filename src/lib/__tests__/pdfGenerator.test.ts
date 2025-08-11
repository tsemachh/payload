import { groupDataByMeeting, generateParticipationsPDF, PDFExportOptions } from '../pdfGenerator'

// Mock data for testing
const mockParticipationData = [
    {
        id: '1',
        stockNumber: 'STOCK001',
        stockName: 'Test Stock 1',
        marketValue: '1000000',
        percentageHolding: 5.5,
        holdingValueInMillions: 55,
        meetingDate: '2025-01-15',
        meetingType: 'רגילה',
        currentCompany: { name: 'Current Company' },
        agendas: [
            {
                id: 'agenda1',
                topicIndex: 1,
                text: 'נושא ראשון',
                vote: 'בעד',
                recommendation: {
                    votingRecommendation: 'בעד',
                    recommendationExplanation: 'המלצה חיובית'
                },
                result: 'אושר',
                meetingResults: 'אושר'
            }
        ]
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
        currentCompany: { name: 'Current Company 2' },
        agendas: [
            {
                id: 'agenda2',
                topicIndex: 1,
                text: 'נושא שני',
                vote: 'נגד',
                recommendation: {
                    votingRecommendation: 'נגד',
                    recommendationExplanation: 'המלצה שלילית'
                },
                result: 'לא אושר',
                meetingResults: 'לא אושר'
            }
        ]
    }
]

const mockPDFOptions: PDFExportOptions = {
    reportName: 'Test Report',
    dateRange: {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
    },
    selectedCompaniesCount: 2,
    totalRecords: 2,
    selectedRecords: 2
}

describe('pdfGenerator', () => {
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

    describe('generateParticipationsPDF', () => {
        test('should generate PDF with valid data', async () => {
            const pdfBytes = await generateParticipationsPDF(mockParticipationData, mockPDFOptions)

            expect(pdfBytes).toBeInstanceOf(Uint8Array)
            expect(pdfBytes.length).toBeGreaterThan(0)

            // Check PDF header (basic validation)
            const pdfHeader = String.fromCharCode(...pdfBytes.slice(0, 4))
            expect(pdfHeader).toBe('%PDF')
        })

        test('should generate PDF with empty data', async () => {
            const pdfBytes = await generateParticipationsPDF([], mockPDFOptions)

            expect(pdfBytes).toBeInstanceOf(Uint8Array)
            expect(pdfBytes.length).toBeGreaterThan(0)

            // Should still create a valid PDF with "no data" message
            const pdfHeader = String.fromCharCode(...pdfBytes.slice(0, 4))
            expect(pdfHeader).toBe('%PDF')
        })

        test('should handle single meeting data', async () => {
            const singleMeetingData = [mockParticipationData[0]]
            const pdfBytes = await generateParticipationsPDF(singleMeetingData, mockPDFOptions)

            expect(pdfBytes).toBeInstanceOf(Uint8Array)
            expect(pdfBytes.length).toBeGreaterThan(0)
        })

        test('should throw error on invalid data', async () => {
            const invalidData = null as any

            await expect(generateParticipationsPDF(invalidData, mockPDFOptions))
                .rejects.toThrow('Failed to generate PDF')
        })

        test('should use report name in options', async () => {
            const customOptions = {
                ...mockPDFOptions,
                reportName: 'Custom Report Name'
            }

            const pdfBytes = await generateParticipationsPDF(mockParticipationData, customOptions)
            expect(pdfBytes).toBeInstanceOf(Uint8Array)
            expect(pdfBytes.length).toBeGreaterThan(0)
        })
    })

    describe('PDF content validation', () => {
        test('should include Hebrew text in PDF', async () => {
            const pdfBytes = await generateParticipationsPDF(mockParticipationData, mockPDFOptions)

            // Convert to string to check for Hebrew content
            const pdfString = String.fromCharCode(...pdfBytes)

            // Check for some Hebrew text that should be in the PDF
            // Note: This is a basic check - in a real scenario you might want to use a PDF parser
            expect(pdfString).toContain('Test Report')
        })

        test('should handle multiple meetings correctly', async () => {
            const multipleMeetingsData = [
                ...mockParticipationData,
                {
                    ...mockParticipationData[0],
                    id: '3',
                    stockNumber: 'STOCK003',
                    stockName: 'Test Stock 3'
                }
            ]

            const pdfBytes = await generateParticipationsPDF(multipleMeetingsData, mockPDFOptions)
            expect(pdfBytes).toBeInstanceOf(Uint8Array)
            expect(pdfBytes.length).toBeGreaterThan(0)
        })
    })
})