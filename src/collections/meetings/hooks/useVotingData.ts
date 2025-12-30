import { useEffect, useState, useMemo } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { groupCompaniesByParent, groupCompaniesByParentAndChecksum } from '@/utils/voteGrouping'
import {
  sortGroupsByParentOrder,
  sortNestedGroupsByParentOrder,
  sortCompaniesWithinGroup,
  sortChecksumGroupsByFirstCompanyOrder,
} from '@/utils/companySort'

interface Company {
  id: string
  name: string
  parentCompany?: string
  nominalValue: number
  percentageHolding: number
  hasRelatedStock?: boolean
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
  const { data } = useDocumentInfo() //meeting data
  const [votedCompanies, setVotedCompanies] = useState<CompanyVoted[]>([])
  const [notVotedCompanies, setNotVotedCompanies] = useState<Company[]>([])
  const [votedLoading, setVotedLoading] = useState(true)
  const [notVotedLoading, setNotVotedLoading] = useState(true)
  const [historicalLoading, setHistoricalLoading] = useState(true)
  const [companyOrderMap, setCompanyOrderMap] = useState<Map<string, string>>(new Map())
  const [historicalHoldings, setHistoricalHoldings] = useState<HistoricalHoldingUi[]>([])

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

  const fetchCompanyOrderMap = async () => {
    try {
      const response = await fetch(`/api/meetings/voting-data/companies-order`)
      if (response.ok) {
        const data: [string, string][] = await response.json()
        const companyOrderMap = new Map<string, string>(data)
        return companyOrderMap
      }
      return new Map<string, string>()
    } catch (e) {
      console.error('Error fetching company order map:', e)
      return new Map<string, string>()
    }
  }

  // Fetch voted companies data
  const fetchVotedCompaniesData = async (meetingId: string) => {
    try {
      const votedResponse = await fetch(
        `/api/meetings/voting-data/voted-companies?meetingId=${meetingId}`,
      )
      if (votedResponse.ok) {
        return await votedResponse.json()
      }
      return []
    } catch (e) {
      console.error('Error fetching voted companies:', e)
      return []
    }
  }

  // Fetch not voted companies data
  const fetchNotVotedCompaniesData = async (meetingId: string) => {
    try {
      const notVotedResponse = await fetch(
        `/api/meetings/voting-data/not-voted-companies?meetingId=${meetingId}`,
      )
      if (notVotedResponse.ok) {
        return await notVotedResponse.json()
      }
      return []
    } catch (e) {
      console.error('Error fetching not voted companies:', e)
      return []
    }
  }

  // Fetch historical holdings data
  const fetchHistoricalHoldingsData = async (meetingId: string) => {
    try {
      const historicalResponse = await fetch(
        `/api/meetings/voting-data/historical-holdings?meetingId=${meetingId}`,
      )
      if (historicalResponse.ok) {
        return await historicalResponse.json()
      }
      return []
    } catch (e) {
      console.error('Error fetching historical holdings:', e)
      return []
    }
  }

  useEffect(() => {
    if (!data) return

    const fetchCompaniesData = async () => {
      if (!Array.isArray(data.companies)) {
        setVotedCompanies([])
        setNotVotedCompanies([])
        setHistoricalHoldings([])
        setVotedLoading(false)
        setNotVotedLoading(false)
        setHistoricalLoading(false)
        return
      }

      try {
        const meetingId = data?.id
        if (!meetingId) return

        // Fetch all three data sources in parallel
        const [companyOrderMap, votedCompaniesData, notVotedCompaniesData, historicalHoldingsData] =
          await Promise.all([
            fetchCompanyOrderMap(),
            fetchVotedCompaniesData(meetingId),
            fetchNotVotedCompaniesData(meetingId),
            fetchHistoricalHoldingsData(meetingId),
          ])

        // Update all state at once to avoid multiple re-renders
        setCompanyOrderMap(companyOrderMap)
        setVotedCompanies(votedCompaniesData)
        setNotVotedCompanies(notVotedCompaniesData)
        setHistoricalHoldings(historicalHoldingsData)
        setVotedLoading(false)
        setNotVotedLoading(false)
        setHistoricalLoading(false)
      } catch (error) {
        console.error('Error fetching companies data:', error)
        setVotedCompanies([])
        setNotVotedCompanies([])
        setHistoricalHoldings([])
        setVotedLoading(false)
        setNotVotedLoading(false)
        setHistoricalLoading(false)
      }
    }

    // Set all loading states to true before fetching
    setVotedLoading(true)
    setNotVotedLoading(true)
    setHistoricalLoading(true)

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

    // ✅ Sort groups by parent company order using utility function
    const sortedGroupEntries = sortGroupsByParentOrder(
      Array.from(grouped.entries()),
      companyOrderMap,
    )

    const result: any[] = []
    sortedGroupEntries.forEach(([parentCompany, subsidiaries]) => {
      const groupId = `group-${parentCompany}`

      // ✅ Sort subsidiaries by their order using utility function
      const sortedSubsidiaries = sortCompaniesWithinGroup(subsidiaries, companyOrderMap)
      if (notVotedSort.field) {
        sortedSubsidiaries.sort((a, b) => {
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

    // ✅ Sort parent groups by parent company order using utility function
    const sortedNestedGroupEntries = sortNestedGroupsByParentOrder(
      Array.from(nestedGroups.entries()),
      companyOrderMap,
    )

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
        // ✅ Sort checksum groups by the _order of the first company in each group
        const sortedChecksumEntries = sortChecksumGroupsByFirstCompanyOrder(
          Array.from(checksumGroups.entries()),
          companyOrderMap,
        )

        sortedChecksumEntries.forEach(([, checksumCompanies]) => {
          const groupColor = colorPalette[checksumGroupIndex % colorPalette.length]
          checksumGroupIndex++

          // ✅ Sort checksum companies by their order using utility function
          const sortedChecksumCompanies = sortCompaniesWithinGroup(
            checksumCompanies,
            companyOrderMap,
          )

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

  const exportToCSV = (exportData: any[], filename: string, columns: any) => {
    const filteredData = exportData.filter((item) => !item.isGroupHeader)

    const columnMapping: any = {
      company: { header: 'חברה', field: 'name' },
      parentCompany: { header: 'חברת אם', field: 'parentCompany' },
      nominalValue: { header: 'ערך נקוב', field: 'nominalValue' },
      percentageHolding: { header: 'אחוזים', field: 'percentageHolding' },
      voter: { header: 'מצביע', field: 'vote.voter' },
      voteTime: { header: 'זמן הצבעה', field: 'vote.votedAt' },
      actualVoteAction: { header: 'הצבעה בפועל', field: 'vote.reported' },
      hasRelatedStock: { header: 'ניירות עוקבים', field: 'hasRelatedStock' },
      checksum: { header: 'Checksum', field: 'vote.checksum' },
    }

    const selectedColumns = Object.keys(columns).filter((key) => columns[key] && columnMapping[key])
    const headers = selectedColumns.map((key) => columnMapping[key].header)
    // Extract meeting metadata from the data variable (meeting data from useDocumentInfo)
    const stockName = data?.stockName
    const stockId = data?.stockId
    const meetingDate = data?.meetingDate
      ? new Date(data.meetingDate).toLocaleDateString('he-IL')
      : ''
    const meetingTime = data?.meetingDate
      ? new Date(data.meetingDate).toLocaleTimeString('he-IL', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''
    const holdingsLimit = data?.holdingsLimit
      ? new Date(data.holdingsLimit).toLocaleDateString('he-IL')
      : ''
    const meetingType = data?.type || ''
    const comments = data?.comments || ''

    // Create metadata rows - field name in first cell, value in second cell
    const metadataRows = [
      `שם נייר,"${stockName}"`,
      `מספר נייר,"${stockId}"`,
      `תאריך אסיפה,"${meetingDate}"`,
      `שעת אסיפה,"${meetingTime}"`,
      `מועד קובע,"${holdingsLimit}"`,
      `סוג אסיפה,"${meetingType}"`,
      `הערות,"${comments.replace(/"/g, '""')}"`, // Escape quotes in comments
      '', // Empty row separator
    ]

    const csvContent = [
      ...metadataRows,
      headers.join(','),
      ...filteredData.map((row) =>
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
            } else if (columnKey === 'hasRelatedStock') {
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
    votedLoading,
    notVotedLoading,
    historicalLoading,
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
