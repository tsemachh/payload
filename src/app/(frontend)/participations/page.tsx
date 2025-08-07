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

export default function Participations() {
  const { companies, funds } = useCompaniesContext()
  const { user } = useAuth()

  // Form state
  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [rangeType, setRangeType] = useState<DateRangeType | undefined>(undefined)
  const [reportName, setReportName] = useState<string>('')
  const [showParticipationTable, setShowParticipationTable] = useState(false)
  const [hasDisplayed, setHasDisplayed] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Applied filters (what's actually being used for the API call)
  const [appliedFilters, setAppliedFilters] = useState({
    selectedFundIds: [] as string[],
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    rangeType: undefined as DateRangeType | undefined,
    voteAgainstRecommendation: false,
    voteDifferentFromResult: false,
    foreignStocksOnly: false,
  })

  // Server-side state (managed by endpoint)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<string>('meetingDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [voteAgainstRecommendation, setVoteAgainstRecommendation] = useState(false)
  const [voteDifferentFromResult, setVoteDifferentFromResult] = useState(false)
  const [foreignStocksOnly, setForeignStocksOnly] = useState(false)

  // Client-side selection state
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set())

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

  const selectedCompaniesCount = useMemo(() => {
    const selectedCompanyIds = new Set<string>()
    appliedFilters.selectedFundIds.forEach((fundId) => {
      const fund = funds.find((f) => f.id === fundId)
      if (fund?.parentCompany) {
        selectedCompanyIds.add(fund.parentCompany)
      }
    })
    return selectedCompanyIds.size
  }, [appliedFilters.selectedFundIds, funds])

  useEffect(() => {
    if (companiesWithFunds.length > 0) {
      const allFundIds = companiesWithFunds.flatMap((company) =>
        company.funds.map((fund) => fund.id),
      )
      setSelectedFundIds(allFundIds)
    }
  }, [companiesWithFunds])

  // Build the API query with all server-side parameters
  const votesQuery = useMemo(() => {
    if (!showParticipationTable || selectedCompanyIds.length === 0) {
      return null
    }

    const params = new URLSearchParams({
      companiesIds: selectedCompanyIds.join(','),
      status: 'published',
      page: currentPage.toString(),
      pageSize: pageSize.toString(),
      sortField: sortField,
      sortDirection: sortDirection,
    })

    if (appliedFilters.startDate && appliedFilters.endDate) {
      params.append('startDate', appliedFilters.startDate.toISOString())
      params.append('endDate', appliedFilters.endDate.toISOString())
    }

    if (searchTerm) {
      params.append('search', searchTerm)
    }

    if (appliedFilters.voteAgainstRecommendation) {
      params.append('voteAgainstRecommendation', 'true')
    }

    if (appliedFilters.voteDifferentFromResult) {
      params.append('voteDifferentFromResult', 'true')
    }

    if (appliedFilters.foreignStocksOnly) {
      params.append('foreignStocksOnly', 'true')
    }

    return `/api/votes/by-companies?${params.toString()}`
  }, [
    selectedCompanyIds,
    appliedFilters.startDate,
    appliedFilters.endDate,
    appliedFilters.voteAgainstRecommendation,
    appliedFilters.voteDifferentFromResult,
    appliedFilters.foreignStocksOnly,
    showParticipationTable,
    currentPage,
    pageSize,
    sortField,
    sortDirection,
    searchTerm,
  ])

  const {
    data: votesResponse,
    isLoading: votesLoading,
    error: votesError,
  } = useSWR(votesQuery, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  // Server-side handlers
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }

  const handleSort = (field: string) => {
    const newDirection = field === sortField ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
    setSortField(field)
    setSortDirection(newDirection)
    setCurrentPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1)
  }

  // The data comes processed from the server
  const participationData: ParticipationTableDataType[] = useMemo(() => {
    return votesResponse?.data || []
  }, [votesResponse])

  const totalItems = votesResponse?.totalItems || 0
  const totalPages = votesResponse?.totalPages || 0

  useEffect(() => {
    if (participationData.length > 0 && showParticipationTable) {
      setDeselectedIds(new Set())
    }
  }, [participationData.length, showParticipationTable])

  const allSelected = deselectedIds.size === 0 && participationData.length > 0

  const participationColumns: Column<ParticipationTableDataType>[] = useMemo(() => {
    const baseColumns: Column<ParticipationTableDataType>[] = [
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
              if (allSelected) {
                const allIds = participationData.map((row) => row.id)
                setDeselectedIds(new Set(allIds))
              } else {
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
              checked={!deselectedIds.has(row.id)}
              onCheckedChange={(checked) => {
                setDeselectedIds((prev) => {
                  const newSet = new Set(prev)
                  if (!checked) {
                    newSet.add(row.id)
                  } else {
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
    ]

    if (selectedCompaniesCount > 1) {
      baseColumns.push({
        key: 'companyName',
        header: 'שם החברה',
        type: 'string',
        minWidth: 120,
        isAlwaysVisible: true,
        render: (row: any) => {
          return row.currentCompany?.name || '-'
        },
      })
    }

    baseColumns.push(
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
        render: (row) => null,
        minWidth: 120,
      },
      {
        key: 'vote',
        header: 'הצבעה',
        type: 'string',
        render: (row) => null,
        minWidth: 100,
      },
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
        minWidth: 90,
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
    )

    return baseColumns
  }, [allSelected, participationData, deselectedIds, selectedCompaniesCount])

  // Form handlers
  const handleFundsSelectionChange = (selected: string[]) => {
    setSelectedFundIds(selected)
    if (hasDisplayed) {
      setHasChanges(true)
    }
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
      setHasChanges(true)
    }
  }

  const handleVoteAgainstRecommendationChange = (checked: boolean) => {
    setVoteAgainstRecommendation(checked)
    if (showParticipationTable) {
      setAppliedFilters((prev) => ({
        ...prev,
        voteAgainstRecommendation: checked,
      }))
      setCurrentPage(1)
    }
    if (hasDisplayed) {
      setHasChanges(true)
    }
  }

  const handleVoteDifferentFromResultChange = (checked: boolean) => {
    setVoteDifferentFromResult(checked)
    if (showParticipationTable) {
      setAppliedFilters((prev) => ({
        ...prev,
        voteDifferentFromResult: checked,
      }))
      setCurrentPage(1)
    }
    if (hasDisplayed) {
      setHasChanges(true)
    }
  }

  const handleForeignStocksOnlyChange = (checked: boolean) => {
    setForeignStocksOnly(checked)
    if (showParticipationTable) {
      setAppliedFilters((prev) => ({
        ...prev,
        foreignStocksOnly: checked,
      }))
      setCurrentPage(1)
    }
    if (hasDisplayed) {
      setHasChanges(true)
    }
  }

  const handleExport = async () => {
    const newAppliedFilters = {
      selectedFundIds: [...selectedFundIds],
      startDate,
      endDate,
      rangeType,
      voteAgainstRecommendation,
      voteDifferentFromResult,
      foreignStocksOnly,
    }

    setAppliedFilters(newAppliedFilters)
    setShowParticipationTable(true)
    setHasDisplayed(true)
    setHasChanges(false)
    setCurrentPage(1)
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

  const renderAgendaRows = useCallback(
    (row: ParticipationTableDataType) => {
      if (!row.agendas || row.agendas.length === 0) {
        return (
          <div className="p-4 text-center text-muted-foreground">
            אין פריטי סדר יום עבור אסיפה זו.
          </div>
        )
      }

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

                      switch (column.key) {
                        case 'select':
                          content = null
                          break
                        case 'companyName':
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
                              className={cn(
                                'relative group',
                                isEnglish ? 'text-left' : 'text-right',
                              )}
                              dir={isEnglish ? 'ltr' : 'rtl'}
                            >
                              <div
                                className="truncate cursor-pointer hover:text-blue-600"
                                style={{
                                  transform:
                                    selectedCompaniesCount > 1
                                      ? 'translateX(70px)'
                                      : 'translateX(50px)',
                                }}
                              >
                                {agenda.text}
                              </div>
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
                          content = (
                            <div
                              style={{
                                transform:
                                  selectedCompaniesCount > 1
                                    ? 'translateX(-10px)'
                                    : 'translateX(0px)',
                              }}
                            >
                              {agenda.recommendation?.votingRecommendation ||
                                agenda.recommendation?.recommendationExplanation ||
                                null}
                            </div>
                          )
                          break
                        case 'vote':
                          content = agenda.vote || null
                          break
                        case 'meetingResults':
                          content = agenda.result
                            ? resultMapping[agenda.result] || agenda.result
                            : agenda.meetingResults || null
                          break
                        case 'simpleMajority':
                          content =
                            agenda.privilegedMajority === false ? (
                              <BooleanIcon iconType={true} />
                            ) : null
                          break
                        case 'specialMajority':
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

                      if (
                        column.key === 'marketValue' ||
                        column.key === 'percentageHolding' ||
                        column.key === 'holdingValueInMillions' ||
                        column.key === 'meetingDate' ||
                        column.key === 'meetingType' ||
                        column.key === 'companyName'
                      ) {
                        return null
                      }

                      const baseColspan = 5
                      const companyColumnExists = selectedCompaniesCount > 1
                      const totalColspan =
                        column.key === 'stockName' ? baseColspan + (companyColumnExists ? 1 : 0) : 1

                      return (
                        <td
                          key={`${agenda.id}-${column.key}`}
                          className={cn(
                            'py-1 px-2 border-t',
                            column.positionCenter ? 'text-center' : 'text-right',
                          )}
                          style={{
                            width:
                              column.key === 'stockName'
                                ? selectedCompaniesCount > 1
                                  ? '750px'
                                  : '650px'
                                : `${column.minWidth}px`,
                            minWidth: column.key === 'stockName' ? '200px' : `${column.minWidth}px`,
                            maxWidth: column.key === 'stockName' ? '100%' : `${column.minWidth}px`,
                            textAlign: column.positionCenter ? 'center' : 'right',
                            verticalAlign: 'middle',
                          }}
                          colSpan={totalColspan}
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
    },
    [participationColumns, selectedCompaniesCount],
  )

  const currentSelectedCount = useMemo(() => {
    if (allSelected) {
      return totalItems
    }
    return Math.max(0, totalItems - deselectedIds.size)
  }, [allSelected, deselectedIds.size, totalItems])

  return (
    <div className="p-4 space-y-0" dir="rtl">
      <div className="flex flex-col lg:flex-row justify-center gap-4 mx-auto">
        <div className="w-full lg:w-[280px] min-h-[200px]">
          <DateRangeSelector onRangeChange={handleRangeChange} />
        </div>

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
                  setHasChanges(true)
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
                (hasDisplayed && !hasChanges)
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
                    totalItems: totalItems,
                    appliedFilters,
                    participationData: participationData.length,
                    votesData: votesResponse,
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

      {showParticipationTable && !votesLoading && !votesError && (
        <div className="flex justify-center">
          <div className="flex justify-start w-full pr-11">
            <span className="text-[rgb(71,122,133)] text-sm">
              נבחרו {currentSelectedCount} רשומות
            </span>
          </div>
        </div>
      )}

      {showParticipationTable &&
        (votesLoading ? (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-2">
              <LoadingSpinnerDiamond />
            </div>
          </div>
        ) : votesError ? (
          <div className="text-center text-red-500 mt-4">
            שגיאה בטעינת נתונים: {votesError.message}
          </div>
        ) : (
          <div className="-mt-4">
            <div className="flex justify-end pr-10 ">
              <div className="flex gap-6 items-center pl-10">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vote-against-recommendation"
                    checked={voteAgainstRecommendation}
                    onCheckedChange={handleVoteAgainstRecommendationChange}
                    className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <Label
                    htmlFor="vote-against-recommendation"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-right"
                  >
                    הצבעה בניגוד להמלצה
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vote-different-from-result"
                    checked={voteDifferentFromResult}
                    onCheckedChange={handleVoteDifferentFromResultChange}
                    className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <Label
                    htmlFor="vote-different-from-result"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-right"
                  >
                    הצבעה שונה מהתוצאה
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="foreign-stocks-only"
                    checked={foreignStocksOnly}
                    onCheckedChange={handleForeignStocksOnlyChange}
                    className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <Label
                    htmlFor="foreign-stocks-only"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-right"
                  >
                    מניות חול בלבד
                  </Label>
                </div>
              </div>
            </div>

            <DataTableServer
              key="participations-table"
              data={participationData}
              columns={participationColumns}
              idField="id"
              defaultSortField={'meetingDate'}
              defaultSortDirection={'desc'}
              tableId="participations-table"
              searchOption={true}
              filterOption={false}
              columnsOption={false}
              tableHeightOffset={280}
              isLoading={votesLoading}
              renderExpandedRowContent={renderAgendaRows}
              expanderColumnKey="stockNumber"
              pagination={{
                pageSize,
                totalItems: totalItems,
                totalPages: totalPages,
                currentPage,
                onPageChange: handlePageChange,
                onPageSizeChange: handlePageSizeChange,
                pageSizeOptions: [10, 25, 50, 100, 500, 1000],
              }}
              onServerSort={handleSort}
              onServerSearch={handleSearch}
              initialSearchTerm={searchTerm}
              searchPlaceholder="חיפוש בשדות הטקסט והמספרים..."
            />
          </div>
        ))}
    </div>
  )
}
