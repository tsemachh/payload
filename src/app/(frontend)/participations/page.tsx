'use client'
import type React from 'react'
import { cn } from '@/lib/utils'
import { useCallback } from 'react'
import { useState, useMemo, useEffect } from 'react'
import { useCompaniesContext } from '../context/companiesContext'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DateRangeSelector } from '../components/ui/date-range-selector'
import { CompanyTreeSelector } from '../holdings/components/CompanySelector'
import { useAuth } from '@payloadcms/ui'
import useSWR from 'swr'
import { fetcher } from '../helpers/utils-data-table'
import type { Column } from '../types/meetings'
import { formatDateTime, parseNumber } from '../helpers/utils-data-table'
import { BooleanIcon } from '@/components/ui/icons'
import { DataTableStatic } from '../components/data-table-client'
import { Checkbox } from '@/components/ui/checkbox'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import { ParticipationTableDataType } from './types'
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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

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

  const { data: meetingsResponse, isLoading } = useSWR('/api/meetings/all-meetings', fetcher)

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

  // Select all rows when data is loaded
  useEffect(() => {
    if (participationData.length > 0 && selectedRows.size === 0) {
      const allRowIds = new Set(participationData.map((row) => row.id))
      setSelectedRows(allRowIds)
    }
  }, [participationData, selectedRows.size])

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
          checked={selectedRows.has(row.id)}
          onCheckedChange={(checked) => {
            setSelectedRows((prev) => {
              const newSet = new Set(prev)
              if (checked) {
                newSet.add(row.id)
              } else {
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
    { key: 'stockName', header: 'שם נייר', type: 'string', minWidth: 120 },
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
    console.log('Selected Funds:', selected)
  }

  const handleRangeChange = (
    newStartDate: Date | undefined,
    newEndDate: Date | undefined,
    type: DateRangeType,
  ) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)
    setRangeType(type)
  }

  const handleExport = () => {
    console.log('Exporting data with:', {
      startDate,
      endDate,
      rangeType,
      selectedFunds: selectedFundIds,
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
                          <div className="flex items-center justify-end gap-2 pr-8 pl-4">
                            <span>{agenda.topicIndex}.</span>
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
                            <div className="truncate cursor-pointer hover:text-blue-600">
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

  return (
    <div className="p-4 space-y-3" dir="rtl">
      <div className="flex flex-col md:flex-row justify-center gap-4 mx-auto">
        {/* Date Range Selector */}
        <div className="w-full md:w-[280px] min-h-[200px]">
          <DateRangeSelector onRangeChange={handleRangeChange} />
        </div>

        {/* Company/Fund Selector */}
        <div className="w-full md:w-[280px]">
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
      </div>

      {/* Export Button */}
      {!showParticipationTable && (
        <div className="flex justify-center mt-4">
          <Button
            onClick={handleExport}
            variant="default"
            disabled={!rangeType || selectedFundIds.length === 0}
          >
            ייצוא
          </Button>
        </div>
      )}

      {/* Selected rows info - Only show when there are selected rows */}
      {showParticipationTable &&
        !isLoading &&
        !meetingsResponse?.error &&
        selectedRows.size > 0 && (
          <div className="flex justify-center mb-4">
            <div className="border border-teal-500 rounded-lg px-4 py-1 bg-white">
              <span className="text-teal-600 font-medium">נבחרו {selectedRows.size} אסיפות</span>
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
          <DataTableStatic
            data={participationData}
            columns={participationColumns}
            idField="id"
            defaultSortField="meetingDate"
            defaultSortDirection="desc"
            tableId="participations-table"
            searchOption={false}
            filterOption={false}
            columnsOption={false}
            tableHeightOffset={280}
            isLoading={isLoading}
            renderExpandedRowContent={renderAgendaRows}
            expanderColumnKey="stockNumber"
          />
        ))}
    </div>
  )
}
