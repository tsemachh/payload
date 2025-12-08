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
import { sortGroupsByParentOrder, sortNestedGroupsByParentOrder, sortCompaniesWithinGroup } from '@/utils/companySort'

interface Company {
  id: string
  name: string
  parentCompany?: string
  nominalValue: number
  percentageHolding: number
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

export const useVotingData = () => {
  const { data } = useDocumentInfo()
  const [votedCompanies, setVotedCompanies] = useState<CompanyVoted[]>([])
  const [notVotedCompanies, setNotVotedCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companyOrderMap, setCompanyOrderMap] = useState<Map<string, string>>(new Map())

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

        let companyNamesMap = new Map<string, { name: string; parentCompanyId: string }>()
        let tempCompanyOrderMap = new Map<string, string>()

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
                  _order: true,
                },
                depth: 0,
                limit: 0,
                sort: '_order',
              },
              { addQueryPrefix: true },
            )
            const companiesResponse = await fetch(`/api/companies${companiesQuery}`)
            if (companiesResponse.ok) {
              const companiesData = await companiesResponse.json()
              companiesData.docs?.forEach((company: any, index: number) => {
                const parentId = getParentCompanyId(company.parentCompany) || ''
                companyNamesMap.set(company.id, {
                  name: company.name,
                  parentCompanyId: parentId,
                })
                tempCompanyOrderMap.set(
                  company.id,
                  company._order !== undefined
                    ? String(company._order)
                    : String(index).padStart(10, '0'),
                )
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

        if (parentCompanyIds.size > 0) {
          try {
            const parentCompaniesQuery = stringify(
              {
                where: {
                  id: { in: Array.from(parentCompanyIds) },
                },
                select: {
                  id: true,
                  _order: true,
                },
                depth: 0,
                limit: 0,
              },
              { addQueryPrefix: true },
            )
            const parentCompaniesResponse = await fetch(`/api/companies${parentCompaniesQuery}`)
            if (parentCompaniesResponse.ok) {
              const parentCompaniesData = await parentCompaniesResponse.json()
              parentCompaniesData.docs?.forEach((parentCompany: any, index: number) => {
                // Store parent company order
                tempCompanyOrderMap.set(
                  parentCompany.id,
                  parentCompany._order !== undefined
                    ? String(parentCompany._order)
                    : String(index).padStart(10, '0'),
                )
              })
            }
          } catch (error) {
            console.error('Error fetching parent companies order:', error)
          }
        }
        setCompanyOrderMap(tempCompanyOrderMap)
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

          return {
            id: vote.company,
            name: vote.companyName,
            parentCompany: parentCompanyName,
            parentCompanyId: parentCompanyId,
            nominalValue: calculatedValues.nominalValue,
            percentageHolding: calculatedValues.percentageHolding,
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

            return {
              id: companyId,
              name: companyInfo.name,
              parentCompany: parentCompanyName,
              parentCompanyId: companyInfo.parentCompanyId,
              nominalValue: calculatedValues.nominalValue,
              percentageHolding: calculatedValues.percentageHolding,
            }
          })
          .filter((company) => company !== null) as Company[]
        setNotVotedCompanies(notVoted)
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
    let processedCompanies = [...notVotedCompanies]

    // Apply sorting if not grouped
    if (!groupByNotVoted && notVotedSort.field) {
      processedCompanies.sort((a, b) => {
        let aValue = a[notVotedSort.field!]
        let bValue = b[notVotedSort.field!]

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

    // ✅ Sort groups by parent company order using utility function
    const sortedGroupEntries = sortGroupsByParentOrder(Array.from(grouped.entries()), companyOrderMap)

    const result: any[] = []
    sortedGroupEntries.forEach(([parentCompany, subsidiaries]) => {
      const groupId = `group-${parentCompany}`

      // ✅ Sort subsidiaries by their order using utility function
      let sortedSubsidiaries = sortCompaniesWithinGroup(subsidiaries, companyOrderMap)
      if (notVotedSort.field) {
        sortedSubsidiaries.sort((a, b) => {
          let aValue = a[notVotedSort.field!]
          let bValue = b[notVotedSort.field!]

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
        parentCompanyId: sortedSubsidiaries[0]?.parentCompanyId || '',
        nominalValue: sortedSubsidiaries.reduce((sum, s) => sum + s.nominalValue, 0),
        percentageHolding: sortedSubsidiaries.reduce((sum, s) => sum + s.percentageHolding, 0),
        isGroupHeader: true,
        isGroupItem: false,
        subsidiaryCount: sortedSubsidiaries.length,
        companies: sortedSubsidiaries,
        isCollapsed: collapsedNotVotedGroups.has(groupId),
      })

      // Add subsidiary companies only if group is not collapsed
      if (!collapsedNotVotedGroups.has(groupId)) {
        sortedSubsidiaries.forEach((company) => {
          result.push({
            ...company,
            isGroupHeader: false,
            isGroupItem: true,
          })
        })
      }
    })

    return result
  }, [notVotedCompanies, groupByNotVoted, collapsedNotVotedGroups, notVotedSort, companyOrderMap])

  // Process data for grouping (voted companies)
  const processedVotedData = useMemo(() => {
    let processedCompanies = [...votedCompanies]

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

    // ✅ Sort parent groups by parent company order using utility function
    const sortedNestedGroupEntries = sortNestedGroupsByParentOrder(Array.from(nestedGroups.entries()), companyOrderMap)

    // Color palette for checksum groups - moved outside to continue across parent companies
    const colorPalette = ['#F7CFD8', '#A6D6D6', '#8E7DBE', '#A3DC9A']
    let checksumGroupIndex = 0 // Start from 0 and continue incrementally

    sortedNestedGroupEntries.forEach(([parentCompany, checksumGroups]) => {
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
        Array.from(checksumGroups.entries()).forEach(([checksum, checksumCompanies]) => {
          const groupColor = colorPalette[checksumGroupIndex % colorPalette.length]
          checksumGroupIndex++

          // ✅ Sort checksum companies by their order using utility function
          let sortedChecksumCompanies = sortCompaniesWithinGroup(checksumCompanies, companyOrderMap)

          // Apply additional sorting if user selected a sort field
          if (votedSort.field) {
            sortedChecksumCompanies.sort((a, b) => {
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
          sortedChecksumCompanies.forEach((company, index) => {
            result.push({
              ...company,
              isGroupHeader: false,
              isGroupItem: true,
              isCompanyItem: true,
              isLastInChecksumGroup: index === sortedChecksumCompanies.length - 1,
              isFirstInChecksumGroup: index === 0,
              checksumGroupSize: sortedChecksumCompanies.length,
              groupColor: groupColor,
            })
          })
        })
      }
    })

    return result
  }, [votedCompanies, groupByVoted, collapsedVotedGroups, votedSort, companyOrderMap])

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
