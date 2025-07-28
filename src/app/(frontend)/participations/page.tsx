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
import { Checkbox } from '@/components/ui/checkbox'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import type { ParticipationTableDataType } from './types'
import { DataTableServer } from '../components/data-table-server'

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

export default function Participations() {
  const { companies, funds } = useCompaniesContext()
  const { user } = useAuth()
  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [rangeType, setRangeType] = useState<DateRangeType | undefined>(undefined)
  const [showParticipationTable, setShowParticipationTable] = useState(false)
  const [reportName, setReportName] = useState<string>('') // New state for report name

  // This state will now track IDs of rows that have been *deselected* from the "all selected" state
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set())

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

  // Construct the query URL based on pagination, sort, date range, and selected funds states
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      pageSize: pageSize.toString(),
      sortField,
      sortDirection,
    })

    // Add selectedFundIds to query parameters if they exist
    if (selectedFundIds.length > 0) {
      params.append('funds', selectedFundIds.join(','))
    }

    return `/api/meetings/all-meetings?${params.toString()}`
  }, [currentPage, pageSize, sortField, sortDirection, startDate, endDate, selectedFundIds]) // Add selectedFundIds to dependencies

  const { data: meetingsResponse, isLoading } = useSWR(query, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  const participationData: ParticipationTableDataType[] = useMemo(() => {
    return (
      meetingsResponse?.data?.map((meeting: any) => ({
        ...meeting,
        id: meeting.meetingIdPayload,
        holdingValueInMillions:
          typeof meeting.holdingValueInMillions === 'string'
            ? Number.parseFloat(meeting.holdingValueInMillions.replace(/,/g, ''))
            : meeting.holdingValueInMillions,
      })) || []
    )
  }, [meetingsResponse?.data])

  // Reset deselectedIds when the total number of items changes (e.g., initial load or filter change)
  useEffect(() => {
    if (meetingsResponse?.totalItems !== undefined) {
      setDeselectedIds(new Set()) // Assume all are selected initially
    }
  }, [meetingsResponse?.totalItems])

  // Define columns for DataTableStatic
  const participationColumns: Column<ParticipationTableDataType>[] = [
    {
      key: 'select',
      header: '',
      type: 'boolean',
      minWidth: 50,
      positionCenter: true,
      isAlwaysVisible: true,
      render: (row) => (
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
      ),
    },
    { key: 'stockNumber', header: 'מספר נייר', type: 'string', minWidth: 120 },
    { key: 'stockName', header: 'שם נייר', type: 'string', minWidth: 200 },
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
      minWidth: 80,
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
      render: (row) => null,
      minWidth: 100,
    },
    { key: 'vote', header: 'הצבעה', type: 'string', render: (row) => null, minWidth: 80 },
    {
      key: 'meetingResults',
      header: 'תוצאות האסיפה',
      type: 'string',
      render: (row) => null,
      minWidth: 100,
    },
    {
      key: 'simpleMajority',
      header: 'רוב רגיל',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'specialMajority',
      header: 'רוב מיוחד',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'policyCompliance',
      header: 'בהתאם למדיניות דירקטריון ו/או וועדת השקעות',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 150,
    },
    {
      key: 'conflictOfInterest',
      header: 'ניגוד עניינים',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 80,
    },
    {
      key: 'relatedParty',
      header: 'צד קשר',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'personalInterest',
      header: 'עניין אישי',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 60,
    },
  ]

  const handleFundsSelectionChange = (selected: string[]) => {
    setSelectedFundIds(selected)
    setCurrentPage(1) // Reset to first page when funds selection changes
  }

  const handleRangeChange = (
    newStartDate: Date | undefined,
    newEndDate: Date | undefined,
    type: DateRangeType,
  ) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)
    setRangeType(type)
    setCurrentPage(1) // Reset to first page when date range changes
  }

  const handleExport = () => {
    console.log('Exporting data with:', {
      startDate,
      endDate,
      rangeType,
      selectedFunds: selectedFundIds,
      reportName, // Include report name in export
    })
    setShowParticipationTable(true)
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
      '1': 'בעד',
      '2': 'נגד',
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
                            <span style={{ marginLeft: 'auto' }}>{agenda.topicIndex}.</span>
                          </div>
                        )
                        break
                      case 'stockName':
                        const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.())
                        content = (
                          <div
                            className={cn(
                              'max-w-[400px] relative group',
                              isEnglish ? 'text-left' : 'text-right',
                            )}
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
                      case 'marketValue':
                      case 'percentageHolding':
                      case 'holdingValueInMillions':
                      case 'meetingDate':
                      case 'meetingType':
                        // These columns remain empty for agenda rows
                        content = null
                        break
                      case 'advisoryRecommendation':
                        // Get recommendation from the nested object
                        content =
                          agenda.recommendation?.votingRecommendation ||
                          agenda.recommendation?.recommendationExplanation ||
                          null
                        break
                      case 'vote':
                        content = agenda.vote || agenda.votingResult || null
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

                    return (
                      <td
                        key={`${agenda.id}-${column.key}`}
                        className={cn(
                          'py-1 px-2 border-t',
                          column.positionCenter ? 'text-center' : 'text-right',
                        )}
                        style={{
                          width: `${column.minWidth}px`,
                          minWidth: `${column.minWidth}px`,
                          maxWidth: `${column.minWidth}px`,
                          textAlign: column.positionCenter ? 'center' : 'right',
                          verticalAlign: 'middle',
                        }}
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
  const currentSelectedCount = (meetingsResponse?.totalItems || 0) - deselectedIds.size

  return (
    <div className="p-4 space-y-3" dir="rtl">
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
          <Input
            id="report-name"
            type="text"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder="הכנס שם לדו״ח"
            className="w-[280px] text-right"
            dir="rtl"
          />
        </div>
      </div>

      {/* Export Button */}
      {!showParticipationTable && (
        <div className="flex justify-center mt-4">
          <Button
            onClick={handleExport}
            variant="default"
            disabled={!rangeType || selectedFundIds.length === 0 || !reportName}
          >
            ייצוא
          </Button>
        </div>
      )}

      {/* Selected rows info - Now reflects total selected based on deselectedIds */}
      {showParticipationTable &&
        !isLoading &&
        !meetingsResponse?.error &&
        currentSelectedCount > 0 && (
          <div className="flex justify-center mb-4">
            <div className="border border-teal-500 rounded-lg px-4 py-1 bg-white">
              <span className="text-teal-600 font-medium">
                נבחרו {currentSelectedCount} אסיפויות
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
          <DataTableServer
            data={participationData}
            columns={participationColumns}
            idField="id"
            defaultSortField={sortField as keyof ParticipationTableDataType} // Pass sortField
            defaultSortDirection={sortDirection} // Pass sortDirection
            tableId="participations-table"
            searchOption={false} // As per your request
            filterOption={false} // As per your request
            columnsOption={false} // As per your request
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
            onServerSort={handleSort} // Pass handleSort
          />
        ))}
    </div>
  )
}
