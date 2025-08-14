import { useEffect, useState } from 'react'
import { stringify } from 'qs-esm'
import { useDocumentInfo } from '@payloadcms/ui'
import { calculateHoldingValues } from '@/utils/dataUtils'

interface Company {
  id: string
  name: string
  motherCompany?: string
  nominalValue: number
  percentageHolding: number
  hasVoted?: boolean
  hasActualVote?: boolean
  vote?: {
    id: string
    decision: 'בעד' | 'נגד' | 'נמנע'
    voter: string
    votedAt: string
    notes?: string
    isReported?: boolean
    checksum?: string
  }
}

export const useVotingData = () => {
  const { savedDocumentData } = useDocumentInfo()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!savedDocumentData) return

    const fetchCompaniesData = async () => {
      if (!Array.isArray(savedDocumentData.companies)) {
        setCompanies([])
        setLoading(false)
        return
      }

      try {
        // Fetch companies data efficiently with a single API call
        const companiesQuery = {
          where: {
            id: {
              in: savedDocumentData?.companies,
            },
          },
          select: {
            id: true,
            name: true,
            parentCompany: true,
          },
          depth: 1,
          limit: 0,
        }

        const companiesStringifiedQuery = stringify(companiesQuery, { addQueryPrefix: true })
        const companiesResponse = await fetch(`/api/companies${companiesStringifiedQuery}`)

        if (!companiesResponse.ok) {
          throw new Error(`Failed to fetch companies: ${companiesResponse.status}`)
        }

        const companiesData = await companiesResponse.json()
        const companies = companiesData.docs || []

        // Get votes data
        const votesData = savedDocumentData.votes.docs

        // Fetch stock value data if we have a stock value ID
        let stockValueData = null
        if (savedDocumentData.stockValue && typeof savedDocumentData.stockValue === 'string') {
          try {
            const stockValueResponse = await fetch(
              `/api/stock-values/${savedDocumentData.stockValue}`,
            )
            if (stockValueResponse.ok) {
              stockValueData = await stockValueResponse.json()
              console.log('!!stockValueData', stockValueData)
            }
          } catch (error) {
            console.error('Error fetching stock value:', error)
          }
        } else if (typeof savedDocumentData.stockValue === 'object') {
          stockValueData = savedDocumentData.stockValue
        }

        // If we have votes, fetch them efficiently
        let votesDetails = []
        if (votesData.length > 0) {
          const voteIds = votesData
            .map((vote: any) => (typeof vote === 'string' ? vote : vote.id))
            .filter(Boolean)

          if (voteIds.length > 0) {
            const votesQuery = {
              where: {
                id: {
                  in: voteIds,
                },
              },
              depth: 1,
              limit: 0,
            }

            const votesStringifiedQuery = stringify(votesQuery, { addQueryPrefix: true })
            const votesResponse = await fetch(`/api/votes${votesStringifiedQuery}`)
            console.log('!!votesResponse', votesResponse)

            if (votesResponse.ok) {
              const votesResponseData = await votesResponse.json()
              votesDetails = votesResponseData.docs || []
              console.log('!!votesDetails', votesDetails)
            }
          }
        }

        // Map companies with voting status and calculate holding values
        const processedCompanies = companies.map((company: any) => {
          const companyVote = votesDetails.find((vote: any) => {
            const voteCompanyId = typeof vote.company === 'string' ? vote.company : vote.company?.id
            return voteCompanyId === company.id
          })

          // Check if this is an actual/reported vote
          const hasActualVote = companyVote && companyVote.reported === true

          // Calculate holding values for this company
          let calculatedValues = {
            nominalValue: 0,
            percentageHolding: 0,
            holdingValueInMillions: 0,
          }

          if (Array.isArray(savedDocumentData.fundsWithHolding)) {
            // Filter fundsWithHolding by company id to get quantity
            const companyHoldings = savedDocumentData.fundsWithHolding.filter((holding: any) => {
              return holding.company === company.id
            })

            if (companyHoldings.length > 0) {
              // Sum up quantities for this company
              const totalQuantity = companyHoldings.reduce((sum: number, holding: any) => {
                return sum + (holding.quantity || 0)
              }, 0)
              console.log('!!totalQuantity', totalQuantity)
              // Calculate holding values using the imported function
              calculatedValues = calculateHoldingValues(totalQuantity, stockValueData)
              console.log('!!calculatedValues', calculatedValues)
            }
          }

          return {
            id: company.id,
            name: company.name || company.fullName || `Company ${company.id}`,
            motherCompany:
              company.parentCompany?.docs?.[0]?.name ||
              company.parentCompany?.docs?.[0]?.fullName ||
              (typeof company.parentCompany === 'string' ? company.parentCompany : null),
            nominalValue: calculatedValues.nominalValue,
            percentageHolding: calculatedValues.percentageHolding,
            hasVoted: !!companyVote,
            hasActualVote: hasActualVote,
            vote: companyVote
              ? {
                  id: companyVote.id,
                  voter:
                    typeof companyVote.creator === 'string'
                      ? companyVote.creator
                      : companyVote.creator?.name || companyVote.creator?.email || 'Unknown',
                  votedAt:
                    companyVote.updatedAt || companyVote.createdAt || new Date().toISOString(),
                  notes: companyVote.notes || '',
                  isReported: companyVote.reported || false,
                  checksum: companyVote.checksum || '',
                }
              : undefined,
          }
        })
        console.log('!!processedCompanies', processedCompanies)

        setCompanies(processedCompanies)
      } catch (error) {
        console.error('Error fetching companies data:', error)
        setCompanies([])
      } finally {
        setLoading(false)
      }
    }

    fetchCompaniesData()
  }, [savedDocumentData])

  return {
    companies,
    loading,
  }
}
