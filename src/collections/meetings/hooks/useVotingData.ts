import { useEffect, useState, useMemo } from 'react'
import { stringify } from 'qs-esm'
import { useDocumentInfo } from '@payloadcms/ui'
import { calculateHoldingValues } from '@/utils/dataUtils'
import {
  getParentCompanyId,
  groupCompaniesByParent,
  groupCompaniesByParentAndChecksum,
} from '@/utils/voteGrouping'
import { getParentCompanyNamesByIds } from '@/utils/utils'
import { HistoricalHolding } from '@/payload-types'

interface Company {
  id: string
  name: string
  parentCompany?: string
  nominalValue: number
  percentageHolding: number
  passiveFunds: boolean
}
interface CompanyVoted extends Company {
  vote: {
    id: string
    voter: string
    votedAt: string
    notes?: string
    reported?: boolean
    checksum?: string
  }
}

interface HistoricalHoldingUi {
  id: string
  companyId: string
  companyName: string
  lastHoldingDate: string
  quantity: number
  fundDetails: Array<{
    fundId: string
    fundName: string
    quantity: number
    lastHoldingDate: string
  }>
}

export const useVotingData = () => {
  const { data } = useDocumentInfo()
  const [votedCompanies, setVotedCompanies] = useState<CompanyVoted[]>([])
  const [notVotedCompanies, setNotVotedCompanies] = useState<Company[]>([])
  const [historicalHoldings, setHistoricalHoldings] = useState<HistoricalHoldingUi[]>([])
  const [loading, setLoading] = useState(true)

  // Grouping states
  const [groupByNotVoted, setGroupByNotVoted] = useState(true)
  const [groupByVoted, setGroupByVoted] = useState(true)
  const [collapsedNotVotedGroups, setCollapsedNotVotedGroups] = useState<Set<string>>(new Set())
  const [collapsedVotedGroups, setCollapsedVotedGroups] = useState<Set<string>>(new Set())

  // Sorting states
  const [notVotedSort, setNotVotedSort] = useState<{
    field: 'nominalValue' | 'percentageHolding' | null
    direction: 'asc' | 'desc'
  }>({ field: null, direction: 'asc' })

  const [votedSort, setVotedSort] = useState<{
    field: 'nominalValue' | 'percentageHolding' | 'voteTime' | null
    direction: 'asc' | 'desc'
  }>({ field: null, direction: 'asc' })

  useEffect(() => {
    if (!data) return

    const fetchCompaniesData = async () => {
      if (!Array.isArray(data.companies)) {
        setVotedCompanies([])
        setLoading(false)
        return
      }

      try {
        // Fetch all funds to create passiveMap
        let passiveMap = new Map<string, boolean>()
        const meetingFundIds = (data.funds || []) as string[]
        if (meetingFundIds.length > 0) {
          const fundsQuery = stringify(
            {
              where: {
                id: { in: meetingFundIds },
              },
              select: {
                id: true,
                passiveFund: true,
              },
              depth: 0,
              limit: 0,
            },
            { addQueryPrefix: true },
          )

          const fundsResponse = await fetch(`/api/companies${fundsQuery}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          })

          if (fundsResponse.ok) {
            const fundsJson = await fundsResponse.json()
            passiveMap = new Map<string, boolean>(
              fundsJson.docs?.map((fund: any) => [fund.id as string, fund.passiveFund || false]) ||
                [],
            )
          } else {
            console.error('Error fetching funds:', fundsResponse.statusText)
          }
        }

        let votesDetails: any[] = []
        try {
          const meetingId = data?.id
          if (meetingId) {
            const votesQuery = stringify(
              {
                where: {
                  and: [{ meeting: { equals: meetingId } }, { _status: { equals: 'published' } }],
                },
                depth: 0,
                limit: 0,
              },
              { addQueryPrefix: true },
            )
            const votesResponse = await fetch(`/api/votes${votesQuery}`)
            if (votesResponse.ok) {
              const votesResponseData = await votesResponse.json()
              votesDetails = votesResponseData.docs || []
            }
          }
        } catch (e) {
          console.error('Error fetching votes:', e)
        }

        // Fetch stock value data if we have a stock value ID
        let stockValueData = null
        if (data.stockValue && typeof data.stockValue === 'string') {
          try {
            const stockValueResponse = await fetch(`/api/stock-values/${data.stockValue}`)
            if (stockValueResponse.ok) {
              stockValueData = await stockValueResponse.json()
            }
          } catch (error) {
            console.error('Error fetching stock value:', error)
          }
        } else if (typeof data.stockValue === 'object') {
          stockValueData = data.stockValue
        }

        // Get all company IDs from the meeting
        const meetingCompanyIds = (data.companies || []) as string[]

        const companyNamesMap = new Map<string, { name: string; parentCompanyId: string }>()
        if (meetingCompanyIds.length > 0) {
          try {
            const companiesQuery = stringify(
              {
                where: {
                  id: { in: meetingCompanyIds },
                },
                select: {
                  name: true,
                  parentCompany: true,
                },
                depth: 0,
                limit: 0,
              },
              { addQueryPrefix: true },
            )
            const companiesResponse = await fetch(`/api/companies${companiesQuery}`)
            if (companiesResponse.ok) {
              const companiesData = await companiesResponse.json()
              companiesData.docs?.forEach((company: any) => {
                const parentId = getParentCompanyId(company.parentCompany) || ''
                companyNamesMap.set(company.id, {
                  name: company.name,
                  parentCompanyId: parentId,
                })
              })
            }
          } catch (error) {
            console.error('Error fetching companies details:', error)
          }
        }

        // Collect unique parent company IDs from votes and companies
        const parentCompanyIds = new Set<string>()
        votesDetails.forEach((vote: any) => {
          const parentId = getParentCompanyId(vote.parentCompany)
          if (parentId) {
            parentCompanyIds.add(parentId)
          }
        })
        companyNamesMap.forEach((info) => {
          if (info.parentCompanyId) {
            parentCompanyIds.add(info.parentCompanyId)
          }
        })

        // Fetch parent company names
        const parentCompanyNamesMap = await getParentCompanyNamesByIds(Array.from(parentCompanyIds))

        // Map companies with voting status and calculate holding values
        const processedCompanies = votesDetails.map((vote: any) => {
          // Calculate holding values for this company
          let calculatedValues = {
            nominalValue: 0,
            percentageHolding: 0,
            holdingValueInMillions: 0,
          }

          if (Array.isArray(data.fundsWithHolding)) {
            // Filter fundsWithHolding by company id to get quantity
            const companyHoldings = data.fundsWithHolding.filter((holding: any) => {
              return holding.company === vote.company
            })
            if (companyHoldings.length > 0) {
              // Sum up quantities for this company
              const totalQuantity = companyHoldings.reduce((sum: number, holding: any) => {
                return sum + (holding.ownedQuantity || holding.quantity || 0)
              }, 0)
              // Calculate holding values using the imported function
              calculatedValues = calculateHoldingValues(totalQuantity, stockValueData)
            }
          }

          const parentCompanyId = getParentCompanyId(vote.parentCompany) || ''
          const parentCompanyName = parentCompanyId
            ? parentCompanyNamesMap.get(parentCompanyId) || vote.companyName
            : vote.companyName

          // Check if all funds holding this company are passive
          const companyFunds =
            data.fundsWithHolding?.filter((holding: any) => holding.company === vote.company) || []
          const hasOnlyPassiveFunds =
            companyFunds.length > 0 &&
            companyFunds.every((holding: any) => passiveMap.get(holding.fund) === true)

          return {
            id: vote.company,
            name: vote.companyName,
            parentCompany: parentCompanyName,
            parentCompanyId: parentCompanyId,
            nominalValue: calculatedValues.nominalValue,
            percentageHolding: calculatedValues.percentageHolding,
            passiveFunds: hasOnlyPassiveFunds,
            vote: {
              id: vote.id,
              voter:
                typeof vote.creator === 'string'
                  ? vote.creator
                  : vote.creator?.name || vote.creator?.email || 'Unknown',
              votedAt: vote.updatedAt || vote.createdAt || new Date().toISOString(),
              notes: vote.notes || '',
              reported: vote.reported || false,
              checksum: vote.checksum || '',
            },
          }
        })
        setVotedCompanies(processedCompanies)

        // Use companiesNotYetVoted from meeting data
        const notVotedCompanyIds = (data.companiesNotYetVoted || []) as string[]
        const notVoted = notVotedCompanyIds
          .map((companyId) => {
            const companyInfo = companyNamesMap.get(companyId)
            if (!companyInfo) return null

            // Calculate holding values for this company
            let calculatedValues = {
              nominalValue: 0,
              percentageHolding: 0,
              holdingValueInMillions: 0,
            }

            if (Array.isArray(data.fundsWithHolding)) {
              // Filter fundsWithHolding by company id to get quantity
              const companyHoldings = data.fundsWithHolding.filter((holding: any) => {
                return holding.company === companyId
              })
              if (companyHoldings.length > 0) {
                // Sum up quantities for this company
                const totalQuantity = companyHoldings.reduce((sum: number, holding: any) => {
                  return sum + (holding.ownedQuantity || holding.quantity || 0)
                }, 0)
                // Calculate holding values using the imported function
                calculatedValues = calculateHoldingValues(totalQuantity, stockValueData)
              }
            }

            const parentCompanyName = companyInfo.parentCompanyId
              ? parentCompanyNamesMap.get(companyInfo.parentCompanyId) || companyInfo.name
              : companyInfo.name

            // Check if all funds holding this company are passive
            const companyFunds =
              data.fundsWithHolding?.filter((holding: any) => holding.company === companyId) || []

            const hasOnlyPassiveFunds =
              companyFunds.length > 0 &&
              companyFunds.every((holding: any) => passiveMap.get(holding.fund) === true)

            return {
              id: companyId,
              name: companyInfo.name,
              parentCompany: parentCompanyName,
              parentCompanyId: companyInfo.parentCompanyId,
              nominalValue: calculatedValues.nominalValue,
              percentageHolding: calculatedValues.percentageHolding,
              passiveFunds: hasOnlyPassiveFunds,
            }
          })
          .filter((company) => company !== null) as Company[]
        setNotVotedCompanies(notVoted)

        // Process historical holdings (companies that held 30 days before but not invited)
        const raw = data.historicalHoldings
        const historicalHoldingsData = Array.isArray(raw) ? raw : ([] as HistoricalHolding)
        if (historicalHoldingsData && historicalHoldingsData.length > 0) {
          // Get unique company IDs from historical holdings
          const historicalCompanyIds = [
            ...new Set(historicalHoldingsData.map((h) => h.company)),
          ] as string[]

          // Get unique fund IDs from historical holdings
          const historicalFundIds = [
            ...new Set(historicalHoldingsData.map((h) => h.fund)),
          ] as string[]

          // Fetch company names and fund names for historical holdings
          if (historicalCompanyIds.length > 0) {
            try {
              // Combine company IDs and fund IDs into a single query since both are in companies collection
              const allIds = [...new Set([...historicalCompanyIds, ...historicalFundIds])]

              const companiesQuery = stringify(
                {
                  where: {
                    id: { in: allIds },
                  },
                  select: {
                    id: true,
                    name: true,
                  },
                  depth: 0,
                  limit: 0,
                },
                { addQueryPrefix: true },
              )
              const companiesResponse = await fetch(`/api/companies${companiesQuery}`)

              const namesMap = new Map<string, string>()

              if (companiesResponse.ok) {
                const companiesData = await companiesResponse.json()
                companiesData.docs?.forEach((item: { id: string; name: string }) => {
                  namesMap.set(item.id, item.name)
                })
              }

              // Group historical holdings by company and aggregate quantities
              const groupedByCompany = new Map<
                string,
                {
                  lastDate: string
                  totalQuantity: number
                  fundDetails: Map<
                    string,
                    { fundName: string; quantity: number; lastHoldingDate: string }
                  >
                }
              >()
              historicalHoldingsData.forEach((holding: NonNullable<HistoricalHolding>[number]) => {
                const companyId = holding.company
                const fundId = holding.fund

                // Skip if companyId or fundId is null/undefined
                if (!companyId || !fundId) return

                const existing = groupedByCompany.get(companyId)
                const holdingDate = holding.lastHoldingDate || ''
                const quantity = holding.quantity || 0

                if (!existing) {
                  const fundDetailsMap = new Map<
                    string,
                    { fundName: string; quantity: number; lastHoldingDate: string }
                  >()
                  fundDetailsMap.set(fundId, {
                    fundName: namesMap.get(fundId) || fundId,
                    quantity,
                    lastHoldingDate: holdingDate,
                  })
                  groupedByCompany.set(companyId, {
                    lastDate: holdingDate,
                    totalQuantity: quantity,
                    fundDetails: fundDetailsMap,
                  })
                } else {
                  // Update last date if this holding is more recent
                  if (new Date(holdingDate) > new Date(existing.lastDate)) {
                    existing.lastDate = holdingDate
                  }
                  // Add to total quantity
                  existing.totalQuantity += quantity
                  // Add or update fund details
                  const existingFund = existing.fundDetails.get(fundId)
                  if (existingFund) {
                    existingFund.quantity += quantity
                    // Update fund's last holding date if this one is more recent
                    if (new Date(holdingDate) > new Date(existingFund.lastHoldingDate)) {
                      existingFund.lastHoldingDate = holdingDate
                    }
                  } else {
                    existing.fundDetails.set(fundId, {
                      fundName: namesMap.get(fundId) || fundId,
                      quantity,
                      lastHoldingDate: holdingDate,
                    })
                  }
                }
              })

              // Create historical holdings array
              const processedHistoricalHoldings: HistoricalHoldingUi[] = Array.from(
                groupedByCompany.entries(),
              ).map(([companyId, holdingData]) => ({
                id: companyId,
                companyId,
                companyName: namesMap.get(companyId) || companyId,
                lastHoldingDate: holdingData.lastDate,
                quantity: holdingData.totalQuantity,
                fundDetails: Array.from(holdingData.fundDetails.entries()).map(
                  ([fundId, fundData]) => ({
                    fundId,
                    fundName: fundData.fundName,
                    quantity: fundData.quantity,
                    lastHoldingDate: fundData.lastHoldingDate,
                  }),
                ),
              }))

              setHistoricalHoldings(processedHistoricalHoldings)
            } catch (error) {
              console.error('Error fetching historical holdings company names:', error)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching companies data:', error)
        setVotedCompanies([])
      } finally {
        setLoading(false)
      }
    }

    fetchCompaniesData()
  }, [data])

  // Process data for grouping (not voted companies)
  const processedNotVotedData = useMemo(() => {
    const processedCompanies = [...notVotedCompanies]

    // Apply sorting if not grouped
    if (!groupByNotVoted && notVotedSort.field) {
      processedCompanies.sort((a, b) => {
        const aValue = a[notVotedSort.field!]
        const bValue = b[notVotedSort.field!]

        if (notVotedSort.direction === 'asc') {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }

    if (!groupByNotVoted) {
      return processedCompanies.map((company) => ({
        ...company,
        isGroupHeader: false,
        isGroupItem: false,
      }))
    }

    const grouped = groupCompaniesByParent(processedCompanies)

    const result: any[] = []
    Array.from(grouped.entries()).forEach(([parentCompany, subsidiaries]) => {
      const groupId = `group-${parentCompany}`

      // Sort subsidiaries if sorting is applied
      if (notVotedSort.field) {
        subsidiaries.sort((a, b) => {
          const aValue = a[notVotedSort.field!]
          const bValue = b[notVotedSort.field!]

          if (notVotedSort.direction === 'asc') {
            return aValue - bValue
          } else {
            return bValue - aValue
          }
        })
      }

      // Add group header
      result.push({
        id: groupId,
        name: parentCompany,
        parentCompanyId: subsidiaries[0]?.parentCompanyId || '',
        nominalValue: subsidiaries.reduce((sum, s) => sum + s.nominalValue, 0),
        percentageHolding: subsidiaries.reduce((sum, s) => sum + s.percentageHolding, 0),
        isGroupHeader: true,
        isGroupItem: false,
        subsidiaryCount: subsidiaries.length,
        companies: subsidiaries,
        isCollapsed: collapsedNotVotedGroups.has(groupId),
      })

      // Add subsidiary companies only if group is not collapsed
      if (!collapsedNotVotedGroups.has(groupId)) {
        subsidiaries.forEach((company) => {
          result.push({
            ...company,
            isGroupHeader: false,
            isGroupItem: true,
          })
        })
      }
    })

    return result
  }, [notVotedCompanies, groupByNotVoted, collapsedNotVotedGroups, notVotedSort])

  // Process data for grouping (voted companies)
  const processedVotedData = useMemo(() => {
    const processedCompanies = [...votedCompanies]

    // Apply sorting if not grouped
    if (!groupByVoted && votedSort.field) {
      processedCompanies.sort((a, b) => {
        let aValue: any
        let bValue: any

        if (votedSort.field === 'voteTime') {
          aValue = a.vote?.votedAt ? new Date(a.vote.votedAt).getTime() : 0
          bValue = b.vote?.votedAt ? new Date(b.vote.votedAt).getTime() : 0
        } else {
          aValue = a[votedSort.field!]
          bValue = b[votedSort.field!]
        }

        if (votedSort.direction === 'asc') {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }

    if (!groupByVoted) {
      return processedCompanies.map((company) => ({
        ...company,
        isGroupHeader: false,
        isGroupItem: false,
      }))
    }

    const result: any[] = []

    // Two-level grouping: first by parent company, then by checksum
    const nestedGroups = groupCompaniesByParentAndChecksum(processedCompanies)

    // Color palette for checksum groups - moved outside to continue across parent companies
    const colorPalette = ['#F7CFD8', '#A6D6D6', '#8E7DBE', '#A3DC9A']
    let checksumGroupIndex = 0 // Start from 0 and continue incrementally

    Array.from(nestedGroups.entries()).forEach(([parentCompany, checksumGroups]) => {
      // Get all companies under this parent for aggregation
      const allCompanies: any[] = []
      checksumGroups.forEach((companies) => allCompanies.push(...companies))

      const parentGroupId = `parent-${parentCompany}`

      // Add parent company group header (first level)
      result.push({
        id: parentGroupId,
        name: parentCompany,
        parentCompany,
        nominalValue: allCompanies.reduce((sum, s) => sum + s.nominalValue, 0),
        percentageHolding: allCompanies.reduce((sum, s) => sum + s.percentageHolding, 0),
        vote: allCompanies[0]?.vote,
        isGroupHeader: true,
        isGroupItem: false,
        isParentGroup: true,
        subsidiaryCount: allCompanies.length,
        companies: allCompanies,
        isCollapsed: collapsedVotedGroups.has(parentGroupId),
      })

      // Add checksum subgroups only if parent company group is not collapsed
      if (!collapsedVotedGroups.has(parentGroupId)) {
        Array.from(checksumGroups.entries()).forEach(([_checksum, checksumCompanies]) => {
          const groupColor = colorPalette[checksumGroupIndex % colorPalette.length]
          checksumGroupIndex++

          // Sort checksum companies if sorting is applied
          if (votedSort.field) {
            checksumCompanies.sort((a, b) => {
              let aValue: any
              let bValue: any

              if (votedSort.field === 'voteTime') {
                aValue = a.vote?.votedAt ? new Date(a.vote.votedAt).getTime() : 0
                bValue = b.vote?.votedAt ? new Date(b.vote.votedAt).getTime() : 0
              } else {
                aValue = a[votedSort.field!]
                bValue = b[votedSort.field!]
              }

              if (votedSort.direction === 'asc') {
                return aValue - bValue
              } else {
                return bValue - aValue
              }
            })
          }

          // Don't add checksum group header - just show companies with background colors
          checksumCompanies.forEach((company, index) => {
            result.push({
              ...company,
              isGroupHeader: false,
              isGroupItem: true,
              isCompanyItem: true,
              isLastInChecksumGroup: index === checksumCompanies.length - 1,
              isFirstInChecksumGroup: index === 0,
              checksumGroupSize: checksumCompanies.length,
              groupColor: groupColor,
            })
          })
        })
      }
    })

    return result
  }, [votedCompanies, groupByVoted, collapsedVotedGroups, votedSort])

  const exportToCSV = (data: any[], filename: string, columns: any) => {
    const exportData = data.filter((item) => !item.isGroupHeader)

    const columnMapping: any = {
      company: { header: 'חברה', field: 'name' },
      parentCompany: { header: 'חברת אם', field: 'parentCompany' },
      nominalValue: { header: 'ערך נקוב', field: 'nominalValue' },
      percentageHolding: { header: 'אחוזים', field: 'percentageHolding' },
      voter: { header: 'מצביע', field: 'vote.voter' },
      voteTime: { header: 'זמן הצבעה', field: 'vote.votedAt' },
      actualVoteAction: { header: 'הצבעה בפועל', field: 'vote.reported' },
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
            } else if (columnKey === 'actualVoteAction') {
              value = value ? '✅' : '❌'
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
  // Group toggle functions
  const toggleNotVotedGroup = (groupId: string) => {
    setCollapsedNotVotedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const toggleVotedGroup = (groupId: string) => {
    setCollapsedVotedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  // Sorting functions
  const handleNotVotedSort = (field: 'nominalValue' | 'percentageHolding') => {
    // Automatically disable grouping when sorting is applied
    setGroupByNotVoted(false)
    // Clear any existing collapsed groups when sorting is applied
    setCollapsedNotVotedGroups(new Set())
    setNotVotedSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleVotedSort = (field: 'nominalValue' | 'percentageHolding' | 'voteTime') => {
    // Automatically disable grouping when sorting is applied
    setGroupByVoted(false)
    // Clear any existing collapsed groups when sorting is applied
    setCollapsedVotedGroups(new Set())
    setVotedSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  return {
    notVotedCompanies,
    votedCompanies: votedCompanies,
    processedNotVotedData,
    processedVotedData,
    historicalHoldings,
    loading,
    exportToCSV,
    // Grouping state and controls
    groupByNotVoted,
    setGroupByNotVoted,
    groupByVoted,
    setGroupByVoted,
    toggleNotVotedGroup,
    toggleVotedGroup,
    // Sorting state and controls
    notVotedSort,
    votedSort,
    handleNotVotedSort,
    handleVotedSort,
  }
}
