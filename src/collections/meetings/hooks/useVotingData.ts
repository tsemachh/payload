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
  const { data } = useDocumentInfo()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!data) return

    const fetchCompaniesData = async () => {
      if (!Array.isArray(data.companies)) {
        setCompanies([])
        setLoading(false)
        return
      }

      try {
        // Fetch companies data efficiently with a single API call
        const companiesQuery = {
          where: {
            id: {
              in: data?.companies,
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
        const votesData = data.votes.docs

        // Fetch stock value data if we have a stock value ID
        let stockValueData = null
        if (data.stockValue && typeof data.stockValue === 'string') {
          try {
            const stockValueResponse = await fetch(
              `/api/stock-values/${data.stockValue}`,
            )
            if (stockValueResponse.ok) {
              stockValueData = await stockValueResponse.json()
            }
          } catch (error) {
            console.error('Error fetching stock value:', error)
          }
        } else if (typeof data.stockValue === 'object') {
          stockValueData = data.stockValue
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
            if (votesResponse.ok) {
              const votesResponseData = await votesResponse.json()
              votesDetails = votesResponseData.docs || []
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

          if (Array.isArray(data.fundsWithHolding)) {
            // Filter fundsWithHolding by company id to get quantity
            const companyHoldings = data.fundsWithHolding.filter((holding: any) => {
              return holding.company === company.id
            })
            if (companyHoldings.length > 0) {
              // Sum up quantities for this company
              const totalQuantity = companyHoldings.reduce((sum: number, holding: any) => {
                return sum + (holding.quantity || 0)
              }, 0)
              // Calculate holding values using the imported function
              calculatedValues = calculateHoldingValues(totalQuantity, stockValueData)
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
        setCompanies(processedCompanies)
      } catch (error) {
        console.error('Error fetching companies data:', error)
        setCompanies([])
      } finally {
        setLoading(false)
      }
    }

    fetchCompaniesData()
  }, [data])

  const exportToCSV = (data: any[], filename: string, columns: any) => {
    const exportData = data.filter((item) => !item.isGroupHeader)

    const columnMapping: any = {
      company: { header: 'חברה', field: 'name' },
      motherCompany: { header: 'חברת אם', field: 'motherCompany' },
      nominalValue: { header: 'ערך נקוב', field: 'nominalValue' },
      percentageHolding: { header: 'אחוזים', field: 'percentageHolding' },
      voter: { header: 'מצביע', field: 'vote.voter' },
      voteTime: { header: 'זמן הצבעה', field: 'vote.votedAt' },
      actualVoteAction: { header: 'הצבעה בפועל', field: 'vote.decision' },
      checksum: { header: 'Checksum', field: 'vote.checksum' },
    }

    const selectedColumns = Object.keys(columns).filter((key) => columns[key] && columnMapping[key])
    const headers = selectedColumns.map((key) => columnMapping[key].header)

    const csvContent = [
      headers.join(','),
      ...exportData.map((row) =>
        selectedColumns
          .map((columnKey) => {
            const field = columnMapping[columnKey].field
            let value = ''

            if (field.includes('.')) {
              const [parent, child] = field.split('.')
              value = row[parent]?.[child] || ''
            } else {
              value = row[field] || ''
            }

            if (columnKey === 'nominalValue' && value) {
              value = Number(value).toLocaleString()
            } else if (columnKey === 'percentageHolding' && value) {
              value = `${Number(value).toFixed(4)}%`
            } else if (columnKey === 'voteTime' && value) {
              value = new Date(value).toLocaleString('he-IL')
            }

            return value.toString().includes(',') ? `"${value}"` : value
          })
          .join(','),
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  return {
    companies,
    loading,
    exportToCSV,
  }
}
