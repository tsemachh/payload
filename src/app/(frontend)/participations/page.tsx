'use client'

import type React from 'react'
import { cn } from '@/lib/utils'
import { useCallback } from 'react'
import { useState, useMemo, useEffect } from 'react'
import { useCompaniesContext } from '../context/companiesContext'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateRangeSelector } from '../components/ui/date-range-selector'
import { CompanyTreeSelector } from '../holdings/components/CompanySelector'
import { useAuth } from '@payloadcms/ui'
import useSWR from 'swr'
import { fetcher } from '../helpers/utils-data-table'
import type { Column } from '../types/meetings'
import { formatDateTime, parseNumber } from '../helpers/utils-data-table'
import { BooleanIcon } from '@/components/ui/icons'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import type { ParticipationTableDataType } from './types'
import { DataTableServer } from '../components/data-table-server'
// Add this import at the top with the other imports
import { fetcherVote } from '../helpers/utils-vote'
import { Checkbox } from '@/components/ui/checkbox'

export interface Company {
  id: string
  name: string
}

export interface Fund {
  id: string
  name: string
  parentCompany: string
}

export interface CompanyWithFunds extends Company {
  funds: Fund[]
}

type DateRangeType = 'two-years' | 'one-year' | 'month' | 'week' | 'custom'

type ReportType =
  | 'different-from-emda'
  | 'different-from-results'
  | 'search-agenda'
  | 'foreign-stocks'
  | 'dual-stocks'

const reportTypeOptions = [
  'different-from-emda',
  'different-from-results',
  'search-agenda',
  'foreign-stocks',
  'dual-stocks',
]

export default function Participations() {
  const { companies, funds } = useCompaniesContext()
  const { user } = useAuth()
  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [rangeType, setRangeType] = useState<DateRangeType | undefined>(undefined)
  const [showParticipationTable, setShowParticipationTable] = useState(false)
  const [reportName, setReportName] = useState<string>('') // New state for report name
  const [selectedReportTypes, setSelectedReportTypes] = useState<ReportType[]>([]) // New state for report types

  // This state will now track IDs of rows that have been *deselected* from the "all selected" state
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set())

  // Add these new states after the existing useState declarations
  const [hasDisplayed, setHasDisplayed] = useState(false) // Track if "הצג" was clicked
  const [hasChanges, setHasChanges] = useState(false) // Track if any filters changed after display
  const [appliedFilters, setAppliedFilters] = useState({
    selectedFundIds: [] as string[],
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    rangeType: undefined as DateRangeType | undefined,
    reportName: '',
  }) // Store the filters that are actually applied

  // States for server-side pagination and sorting
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<string>('meetingDate') // Default sort field
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc') // Default sort direction

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1) // reset to first page when page size changes
  }

  const handleSort = (field: string) => {
    const newDirection = field === sortField ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
    setSortField(field)
    setSortDirection(newDirection)
    setCurrentPage(1) // Reset to first page on sort change
  }

  const companiesWithFunds: CompanyWithFunds[] = useMemo(() => {
    const companyMap = new Map<string, CompanyWithFunds>(
      companies.map((company) => [company.id, { ...company, funds: [] }]),
    )

    funds.forEach((fund) => {
      if (!fund.parentCompany) return
      const company = companyMap.get(fund.parentCompany)
      if (company) {
        company.funds.push(fund as Fund)
      }
    })

    return Array.from(companyMap.values())
  }, [companies, funds])

  useEffect(() => {
    if (companiesWithFunds.length > 0) {
      const allFundIds = companiesWithFunds.flatMap((company) =>
        company.funds.map((fund) => fund.id),
      )
      setSelectedFundIds(allFundIds)
    }
  }, [companiesWithFunds])

  // Update the query useMemo to send date filters in the correct format that the server expects
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      pageSize: pageSize.toString(),
      sortField,
      sortDirection,
    })

    // Use appliedFilters instead of current state
    if (appliedFilters.selectedFundIds.length > 0) {
      params.append('funds', appliedFilters.selectedFundIds.join(','))
    }

    // Add date filters in the format the server expects
    if (appliedFilters.startDate && appliedFilters.endDate) {
      const dateFilter = {
        past: null,
        future: null,
        empty: false,
        custom: true,
        customDate: {
          startDate: appliedFilters.startDate.toISOString(),
          endDate: appliedFilters.endDate.toISOString(),
        },
      }
      params.append('dateFilter_meetingDate', JSON.stringify(dateFilter))
    }

    return `/api/meetings/all-meetings?${params.toString()}`
  }, [currentPage, pageSize, sortField, sortDirection, appliedFilters])

  const { data: meetingsResponse, isLoading } = useSWR(query, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  // Map selectedFundIds to their parent company IDs
  const selectedCompanyIds = useMemo(() => {
    const companyIds = new Set<string>()
    appliedFilters.selectedFundIds.forEach((fundId) => {
      const fund = funds.find((f) => f.id === fundId)
      if (fund?.parentCompany) {
        companyIds.add(fund.parentCompany)
      }
    })
    return Array.from(companyIds)
  }, [appliedFilters.selectedFundIds, funds])

  // Create individual SWR calls for each meeting
  const [meetingVotesData, setMeetingVotesData] = useState<{ [meetingId: string]: any[] }>({})

  useEffect(() => {
    if (
      !meetingsResponse?.data ||
      meetingsResponse?.data.length === 0 ||
      selectedCompanyIds.length === 0
    ) {
      setMeetingVotesData({})
      return
    }

    const fetchVotesData = async () => {
      const votesMap: { [meetingId: string]: any[] } = {}

      // For each meeting, we'll create a separate API call
      const meetingIds = meetingsResponse.data.map((meeting: any) => meeting.meetingIdPayload)
      const votePromises = meetingIds.map((meetingId: string) => {
        const swrKey =
          selectedCompanyIds.length > 0
            ? `/api/votes/by-meeting-and-companies?meetingId=${meetingId}&companiesIds=${selectedCompanyIds.join(',')}&status=published`
            : null

        return swrKey ? fetcherVote(swrKey) : Promise.resolve([])
      })

      const voteResults = await Promise.all(votePromises)

      meetingIds.forEach((meetingId: string, index: number) => {
        votesMap[meetingId] = voteResults[index]
      })

      setMeetingVotesData(votesMap)
    }

    fetchVotesData()
  }, [meetingsResponse?.data, selectedCompanyIds])

  // Combine all votes data
  const allVotesData = useMemo(() => {
    return meetingVotesData
  }, [meetingVotesData])

  // Update the participationData useMemo to include votes data
  const participationData: ParticipationTableDataType[] = useMemo(() => {
    const baseData =
      meetingsResponse?.data?.map((meeting: any) => ({
        ...meeting,
        id: meeting.meetingIdPayload,
        holdingValueInMillions:
          typeof meeting.holdingValueInMillions === 'string'
            ? Number.parseFloat(meeting.holdingValueInMillions.replace(/,/g, ''))
            : meeting.holdingValueInMillions,
      })) || []

    // Merge votes data with meetings data
    return baseData.map((meeting: any) => {
      const meetingVotes = allVotesData[meeting.meetingIdPayload] || []

      // Update agendas with vote data
      const updatedAgendas =
        meeting.agendas?.map((agenda: any) => {
          // Find vote for this agenda item
          const voteData = meetingVotes.find((vote: any) => {
            return vote.votes?.some((v: any) => v.topicIndex === agenda.topicIndex)
          })

          const agendaVote = voteData?.votes?.find((v: any) => v.topicIndex === agenda.topicIndex)

          return {
            ...agenda,
            vote: agendaVote?.voteDecision || null,
            policyCompliance: agendaVote?.isInvestmentCommittee,
            conflictOfInterest: agendaVote?.hasConflictOfInterest,
            relatedParty: agendaVote?.isRelatedParty,
            personalInterest: agendaVote?.hasPersonalInterest,
          }
        }) || []

      return {
        ...meeting,
        agendas: updatedAgendas,
        votes: meetingVotes,
        hasVotes: meetingVotes.length > 0,
      }
    })
  }, [meetingsResponse?.data, allVotesData])

  // Reset deselectedIds when the total number of items changes (e.g., initial load or filter change)
  useEffect(() => {
    if (meetingsResponse?.totalItems !== undefined) {
      setDeselectedIds(new Set()) // Assume all are selected initially
    }
  }, [meetingsResponse?.totalItems])

  // Check if all items are selected - move this calculation closer to where it's used
  const allSelected = deselectedIds.size === 0 && (meetingsResponse?.totalItems || 0) > 0

  // Define columns for DataTableStatic
  const participationColumns: Column<ParticipationTableDataType>[] = [
    {
      key: 'select',
      header: 'בחר הכל',
      type: 'boolean',
      minWidth: 80,
      positionCenter: true,
      isAlwaysVisible: true,
      filterable: false,
      renderHeader: () => (
        <div
          className="cursor-pointer text-[rgb(71,122,133)] hover:text-[rgb(61,112,123)] font-medium text-sm border-b border-[rgb(71,122,133)] pb-1"
          onClick={() => {
            console.log('Header clicked!', {
              allSelected,
              deselectedIds: deselectedIds.size,
              totalItems: meetingsResponse?.totalItems,
            })
            if (allSelected) {
              // Deselect all - create a set with ALL possible IDs (simulate all items being deselected)
              // Since we can't get all IDs from all pages, we'll use a large number to represent "all deselected"
              const totalItems = meetingsResponse?.totalItems || 0
              // Create a set that represents all items being deselected
              setDeselectedIds(
                new Set(Array.from({ length: totalItems }, (_, i) => `deselected_${i}`)),
              )
              // Also add current page IDs to be sure
              const currentPageIds = participationData.map((row) => row.id)
              setDeselectedIds((prev) => new Set([...prev, ...currentPageIds]))
            } else {
              // Select all - clear deselectedIds completely
              setDeselectedIds(new Set())
            }
          }}
        >
          {allSelected ? 'בטל הכל' : 'בחר הכל'}
        </div>
      ),
      render: (row) => (
        <div className="flex justify-center">
          <Checkbox
            // An item is checked if its ID is NOT in the deselectedIds set
            checked={!deselectedIds.has(row.id)}
            onCheckedChange={(checked) => {
              setDeselectedIds((prev) => {
                const newSet = new Set(prev)
                if (!checked) {
                  // User unchecked this row, add its ID to deselectedIds
                  newSet.add(row.id)
                } else {
                  // User checked this row (it was previously deselected), remove its ID from deselectedIds
                  newSet.delete(row.id)
                }
                return newSet
              })
            }}
            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
        </div>
      ),
    },
    { key: 'stockNumber', header: 'מספר נייר / נושאי האסיפה', type: 'string', minWidth: 120 },
    { key: 'stockName', header: 'שם נייר', type: 'string', minWidth: 120 }, // Back to original width
    {
      key: 'marketValue',
      header: 'שווי שוק',
      type: 'string',
      render: (row) => {
        const value = parseNumber(row.marketValue)
        return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(value)
      },
      minWidth: 100,
    },
    {
      key: 'percentageHolding',
      header: 'אחזקה (%)',
      type: 'number',
      render: (row) =>
        new Intl.NumberFormat('he-IL', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(row.percentageHolding),
      minWidth: 100,
    },
    {
      key: 'holdingValueInMillions',
      header: 'שווי אחזקה',
      type: 'number',
      render: (row) =>
        new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(
          row.holdingValueInMillions,
        ),
      minWidth: 50,
    },
    {
      key: 'meetingDate',
      header: 'מועד האסיפה',
      type: 'datetime',
      render: (row) => formatDateTime(row.meetingDate),
      minWidth: 130,
    },
    { key: 'meetingType', header: 'סוג האסיפה', type: 'string', minWidth: 80 },
    {
      key: 'advisoryRecommendation',
      header: 'המלצת גורם מייעץ',
      type: 'string',
      render: (row) => null, // רק בשורות המורחבות
      minWidth: 120,
    },
    {
      key: 'vote',
      header: 'הצבעה',
      type: 'string',
      render: (row) => null, // רק בשורות המורחבות
      minWidth: 80,
    },
    {
      key: 'meetingResults',
      header: 'תוצאות האסיפה',
      type: 'string',
      render: (row) => null, // רק בשורות המורחבות
      minWidth: 100,
    },
    {
      key: 'simpleMajority',
      header: 'רוב רגיל',
      type: 'boolean',
      render: (row) => null, // רק בשורות המורחבות
      positionCenter: true,
      minWidth: 90,
    },
    {
      key: 'specialMajority',
      header: 'רוב מיוחד',
      type: 'boolean',
      render: (row) => null, // רק בשורות המורחבות
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'policyCompliance',
      header: 'בהתאם למדיניות דירקטריון ו/או וועדת השקעות',
      type: 'boolean',
      render: (row) => null, // רק בשורות המורחבות
      positionCenter: true,
      minWidth: 150,
    },
    {
      key: 'conflictOfInterest',
      header: 'ניגוד עניינים',
      type: 'boolean',
      render: (row) => null, // רק בשורות המורחבות
      positionCenter: true,
      minWidth: 80,
    },
    {
      key: 'relatedParty',
      header: 'צד קשר',
      type: 'boolean',
      render: (row) => null, // רק בשורות המורחבות
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'personalInterest',
      header: 'עניין אישי',
      type: 'boolean',
      render: (row) => null, // רק בשורות המורחבות
      positionCenter: true,
      minWidth: 60,
    },
  ]

  const handleFundsSelectionChange = (selected: string[]) => {
    setSelectedFundIds(selected)
    if (hasDisplayed) {
      setHasChanges(true) // Mark that changes were made after display
    }
    // Remove the setCurrentPage(1) from here since we don't want immediate filtering
  }

  const handleRangeChange = (
    newStartDate: Date | undefined,
    newEndDate: Date | undefined,
    type: DateRangeType,
  ) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)
    setRangeType(type)
    if (hasDisplayed) {
      setHasChanges(true) // Mark that changes were made after display
    }
    // Remove the setCurrentPage(1) from here since we don't want immediate filtering
  }

  const handleExport = () => {
    // Apply the current filters
    setAppliedFilters({
      selectedFundIds: [...selectedFundIds],
      startDate,
      endDate,
      rangeType,
      reportName,
    })

    setShowParticipationTable(true)
    setHasDisplayed(true) // Mark that display button was clicked
    setHasChanges(false) // Reset changes flag
    setCurrentPage(1) // Reset to first page when applying new filters
  }

  const getCompanySelectSummary = () => {
    if (selectedFundIds.length === 0) {
      return 'בחר חברות/חשבונות'
    }

    const totalFundIds = companiesWithFunds.flatMap((company) =>
      company.funds.map((fund) => fund.id),
    )

    const allSelected =
      selectedFundIds.length === totalFundIds.length &&
      selectedFundIds.every((id) => totalFundIds.includes(id))

    if (allSelected) {
      return 'נבחרו הכל'
    }

    return `נבחרו ${selectedFundIds.length} חשבונות`
  }

  // Function to calculate column widths
  const calculateColumnWidths = (minWidth: number, totalColumns: number, width?: number) => {
    // If a specific width is provided, use it
    if (width) {
      return width
    }
    // Distribute available width evenly
    return minWidth
  }

  // Function to render agenda items for expanded rows
  const renderAgendaRows = useCallback((row: ParticipationTableDataType) => {
    if (!row.agendas || row.agendas.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          אין פריטי סדר יום עבור אסיפה זו.
        </div>
      )
    }

    // Add result mapping
    const resultMapping: { [key: string]: string } = {
      '0': '---',
      '1': 'אושר',
      '2': 'לא אושר',
      '3': 'דיון',
    }

    return (
      <div className="w-full">
        <table className="w-full table-fixed border-collapse" style={{ tableLayout: 'fixed' }}>
          <tbody>
            {row.agendas.map((agenda: any, agendaIndex: number) => {
              return (
                <tr
                  key={agenda.id}
                  className={cn(agendaIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50')}
                >
                  {participationColumns.map((column, columnIndex) => {
                    let content: React.ReactNode = null

                    // Handle each column specifically
                    switch (column.key) {
                      case 'select':
                        // Empty cell for agenda rows
                        content = null
                        break
                      case 'stockNumber':
                        content = (
                          <div className="flex items-center justify-end gap-2 pr-16 pl-4">
                            <span style={{ marginLeft: 'auto', transform: 'translateX(20px)' }}>
                              {agenda.topicIndex}.
                            </span>
                          </div>
                        )
                        break
                      case 'stockName':
                        const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.())
                        content = (
                          <div
                            className={cn('relative group', isEnglish ? 'text-left' : 'text-right')}
                            dir={isEnglish ? 'ltr' : 'rtl'}
                          >
                            <div
                              className="truncate cursor-pointer hover:text-blue-600"
                              style={{ transform: 'translateX(50px)' }}
                            >
                              {agenda.text}
                            </div>
                            {/* Tooltip on hover */}
                            <div
                              className="absolute z-50 invisible group-hover:visible bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg max-w-md whitespace-normal break-words top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              style={{
                                [isEnglish ? 'left' : 'right']: 0,
                              }}
                            >
                              {agenda.text}
                              <div
                                className={cn(
                                  'absolute bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent',
                                  isEnglish
                                    ? 'left-4 border-b-gray-900'
                                    : 'right-4 border-b-gray-900',
                                )}
                              />
                            </div>
                          </div>
                        )
                        break
                      case 'advisoryRecommendation':
                        // Get recommendation from the nested object
                        content =
                          agenda.recommendation?.votingRecommendation ||
                          agenda.recommendation?.recommendationExplanation ||
                          null
                        break
                      case 'vote':
                        // Show the actual vote decision
                        content = agenda.vote || null
                        break
                      case 'meetingResults':
                        // Use the result field with mapping
                        content = agenda.result
                          ? resultMapping[agenda.result] || agenda.result
                          : agenda.meetingResults || null
                        break
                      case 'simpleMajority':
                        // Show icon under "רוב רגיל" if privilegedMajority is false or undefined
                        content =
                          agenda.privilegedMajority === false ? (
                            <BooleanIcon iconType={true} />
                          ) : null
                        break
                      case 'specialMajority':
                        // Show only percentage under "רוב מיוחד" if privilegedMajority is true
                        content =
                          agenda.privilegedMajority === true && agenda.vPercentSpecial
                            ? `${agenda.vPercentSpecial}%`
                            : null
                        break
                      case 'policyCompliance':
                        content =
                          agenda.policyCompliance !== undefined &&
                          agenda.policyCompliance !== null ? (
                            <BooleanIcon iconType={agenda.policyCompliance} />
                          ) : null
                        break
                      case 'conflictOfInterest':
                        content =
                          agenda.conflictOfInterest !== undefined &&
                          agenda.conflictOfInterest !== null ? (
                            <BooleanIcon iconType={agenda.conflictOfInterest} />
                          ) : null
                        break
                      case 'relatedParty':
                        content =
                          agenda.relatedParty !== undefined && agenda.relatedParty !== null ? (
                            <BooleanIcon iconType={agenda.relatedParty} />
                          ) : null
                        break
                      case 'personalInterest':
                        content =
                          agenda.personalInterest !== undefined &&
                          agenda.personalInterest !== null ? (
                            <BooleanIcon iconType={agenda.personalInterest} />
                          ) : null
                        break
                      default:
                        content = null
                        break
                    }

                    // Skip columns that are covered by stockName colspan
                    if (
                      column.key === 'marketValue' ||
                      column.key === 'percentageHolding' ||
                      column.key === 'holdingValueInMillions' ||
                      column.key === 'meetingDate' ||
                      column.key === 'meetingType'
                    ) {
                      return null
                    }

                    return (
                      <td
                        key={`${agenda.id}-${column.key}`}
                        className={cn(
                          'py-1 px-2 border-t',
                          column.positionCenter ? 'text-center' : 'text-right',
                        )}
                        style={{
                          width: column.key === 'stockName' ? '650px' : `${column.minWidth}px`,
                          minWidth: column.key === 'stockName' ? '200px' : `${column.minWidth}px`,
                          maxWidth: column.key === 'stockName' ? '100%' : `${column.minWidth}px`,
                          textAlign: column.positionCenter ? 'center' : 'right',
                          verticalAlign: 'middle',
                        }}
                        colSpan={column.key === 'stockName' ? 5 : 1} // Span across 5 columns: stockName, marketValue, percentageHolding, holdingValueInMillions, meetingDate, meetingType
                      >
                        {content}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }, [])

  // Calculate the number of currently selected items
  const currentSelectedCount = allSelected
    ? meetingsResponse?.totalItems || 0
    : Math.max(0, (meetingsResponse?.totalItems || 0) - deselectedIds.size)

  return (
    <div className="p-4 space-y-0" dir="rtl">
      <div className="flex flex-col lg:flex-row justify-center gap-4 mx-auto">
        {/* Date Range Selector */}
        <div className="w-full lg:w-[280px] min-h-[200px]">
          <DateRangeSelector onRangeChange={handleRangeChange} />
        </div>

        {/* Company/Fund Selector */}
        <div className="w-full lg:w-[280px]">
          <label className="text-base font-semibold mb-2 block text-right">חברות</label>
          <Select>
            <SelectTrigger className="w-[280px] flex-row-reverse justify-between text-right">
              <SelectValue placeholder={getCompanySelectSummary()} />
            </SelectTrigger>
            <SelectContent align="end" dir="rtl" className="p-0">
              <CompanyTreeSelector
                selectedCompanies={selectedFundIds}
                onSelectionChangeAction={handleFundsSelectionChange}
                className="w-full"
                showSearch={false}
              />
            </SelectContent>
          </Select>
        </div>

        {/* Report Name Input */}
        <div className="w-full lg:w-[280px]">
          <Label htmlFor="report-name" className="text-base font-semibold mb-2 block text-right">
            שם הדו״ח
          </Label>
          <div className="flex gap-2 items-end">
            <Input
              id="report-name"
              type="text"
              value={reportName}
              onChange={(e) => {
                setReportName(e.target.value)
                if (hasDisplayed) {
                  setHasChanges(true) // Mark that changes were made after display
                }
              }}
              placeholder="הכנס שם לדו״ח"
              className="w-[280px] text-right"
              dir="rtl"
            />
            <Button
              onClick={handleExport}
              variant="default"
              disabled={
                !rangeType ||
                selectedFundIds.length === 0 ||
                !reportName ||
                (hasDisplayed && !hasChanges) // Disable if already displayed and no changes
              }
              className="whitespace-nowrap"
            >
              הצג
            </Button>
            {showParticipationTable && (
              <Button
                onClick={() => {
                  console.log('Exporting file with data:', {
                    reportName,
                    selectedCount: currentSelectedCount,
                    totalItems: meetingsResponse?.totalItems,
                    appliedFilters,
                    participationData: participationData.length,
                  })
                }}
                variant="default"
                className="whitespace-nowrap"
              >
                ייצוא הקובץ
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Selected rows info - Now reflects total selected based on deselectedIds */}
      {showParticipationTable && !isLoading && !meetingsResponse?.error && (
        <div className="flex justify-center">
          <div className="flex justify-start w-full pr-11">
            <span className="text-[rgb(71,122,133)] text-sm">
              נבחרו {currentSelectedCount} אסיפות
            </span>
          </div>
        </div>
      )}

      {/* Participation Table */}
      {showParticipationTable &&
        (isLoading ? (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-2">
              <LoadingSpinnerDiamond />
            </div>
          </div>
        ) : meetingsResponse?.error ? (
          <div className="text-center text-red-500 mt-4">
            שגיאה בטעינת נתונים: {meetingsResponse.error.message}
          </div>
        ) : (
          <div className="-mt-4">
            <DataTableServer
              data={participationData}
              columns={participationColumns}
              idField="id"
              defaultSortField={'meetingDate'}
              defaultSortDirection={'desc'}
              tableId="participations-table"
              searchOption={false}
              filterOption={false}
              columnsOption={false}
              tableHeightOffset={280}
              isLoading={isLoading}
              renderExpandedRowContent={renderAgendaRows}
              expanderColumnKey="stockNumber"
              pagination={{
                pageSize,
                totalItems: meetingsResponse?.totalItems || 0,
                totalPages: meetingsResponse?.totalPages || 0,
                currentPage,
                onPageChange: handlePageChange,
                onPageSizeChange: handlePageSizeChange,
                pageSizeOptions: [10, 25, 50, 100, 500, 1000],
              }}
              onServerSort={handleSort}
            />
          </div>
        ))}
    </div>
  )
}
