'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCompaniesContext } from '../context/companiesContext'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateRangeSelector } from '../components/ui/date-range-selector'
import { CompanyTreeSelector } from '../holdings/components/CompanySelector'
import useSWR from 'swr'
import { fetcher, formatDateTime, parseNumber } from '../helpers/utils-data-table'
import type { Column } from '../types/meetings'
import { BooleanIcon } from '@/components/ui/icons'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import type { ParticipationTableDataType } from './types'
import { DataTableServer } from '../components/data-table-server'
import { Checkbox } from '@/components/ui/checkbox'
import { resultMapping } from '@/lib/exportTypes'
import { ExportDropdownButton, type ExportFormat } from '../components/export-dropdown-button'

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

  // Form state
  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [rangeType, setRangeType] = useState<DateRangeType | undefined>(undefined)
  const [reportName, setReportName] = useState<string>('')

  // Applied filters (what's actually being used for the API call)
  const [appliedFilters, setAppliedFilters] = useState({
    selectedFundIds: [] as string[],
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    rangeType: undefined as DateRangeType | undefined,
    voteAgainstRecommendation: false,
    voteDifferentFromResult: false,
    foreignStocksOnly: false,
    dualMeetingsOnly: false,
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
  const [dualMeetingsOnly, setDualMeetingsOnly] = useState(false)
  // Client-side selection state
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

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

  useEffect(() => {
    if (rangeType && selectedFundIds.length > 0) {
      setAppliedFilters((prev) => ({
        ...prev,
        selectedFundIds: [...selectedFundIds],
        startDate,
        endDate,
        rangeType,
      }))
      setCurrentPage(1)
    }
  }, [selectedFundIds, startDate, endDate, rangeType])

  // Build the API query with all server-side parameters
  const votesQuery = useMemo(() => {
    if (selectedCompanyIds.length === 0 || !appliedFilters.rangeType) {
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

    if (appliedFilters.selectedFundIds.length > 0) {
      params.append('fundIds', appliedFilters.selectedFundIds.join(','))
    }

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
    if (appliedFilters.dualMeetingsOnly) {
      params.append('dualMeetingsOnly', 'true')
    }
    return `/api/votes/by-companies?${params.toString()}`
  }, [
    selectedCompanyIds,
    appliedFilters,
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
    if (participationData.length > 0) {
      setDeselectedIds(new Set())
    }
  }, [participationData.length])

  const allSelected = deselectedIds.size === 0 && participationData.length > 0

  const participationColumns: Column<ParticipationTableDataType>[] = useMemo(() => {
    const baseColumns: Column<ParticipationTableDataType>[] = [
      {
        key: 'select',
        header: 'בחר הכל',
        type: 'boolean',
        minWidth: 25,
        positionCenter: true,
        isAlwaysVisible: true,
        filterable: false,
        renderHeader: () => (
          <div className="flex justify-center mr-[18px]">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  setDeselectedIds(new Set())
                } else {
                  const allIds = participationData.map((row) => row.id)
                  setDeselectedIds(new Set(allIds))
                }
              }}
              className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground w-5 h-5"
            />
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
      {
        key: 'stockNumber',
        header: 'מספר נייר /  \n נושאי האסיפה',
        type: 'string',
        minWidth: 80,
      },
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
        header: `שווי שוק (מ' ₪)`,
        type: 'string',
        render: (row) => {
          const marketValue = parseNumber(row.marketValue)
          return new Intl.NumberFormat('he-IL', {
            maximumFractionDigits: 0,
          }).format(marketValue / 1_000_000)
        },
        minWidth: 80,
      },
      {
        key: 'percentageHolding',
        header: 'החזקה (%)',
        type: 'number',
        render: (row) =>
          new Intl.NumberFormat('he-IL', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
          }).format(row.percentageHolding),
        minWidth: 80,
      },
      {
        key: 'holdingValueInMillions',
        header: `שווי החזקה (מ' ₪)`,
        type: 'number',
        render: (row) =>
          new Intl.NumberFormat('he-IL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(row.holdingValueInMillions),
        minWidth: 80,
      },
      {
        key: 'meetingDate',
        header: 'מועד האסיפה',
        type: 'datetime',
        render: (row) => formatDateTime(row.meetingDate),
        minWidth: 120,
      },
      { key: 'meetingType', header: 'סוג האסיפה', type: 'string', minWidth: 80 },
      {
        key: 'advisoryRecommendation',
        header: 'המלצת גורם מייעץ',
        type: 'string',
        render: (row) => null,
        minWidth: 70,
      },
      {
        key: 'vote',
        header: 'הצבעה',
        type: 'string',
        render: (row) => null,
        minWidth: 70,
      },
      {
        key: 'meetingResults',
        header: 'תוצאות האסיפה',
        type: 'string',
        render: (row) => null,
        minWidth: 75,
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
        header: 'רוב מיוחד (%)',
        type: 'string',
        render: (row) => null,
        minWidth: 40,
      },
      {
        key: 'policyCompliance',
        header: 'בהתאם למדיניות דירקטריון ו/או וועדת השקעות',
        type: 'boolean',
        render: (row) => null,
        positionCenter: true,
        minWidth: 60,
      },
      {
        key: 'conflictOfInterest',
        header: 'ניגוד עניינים',
        type: 'boolean',
        render: (row) => null,
        positionCenter: true,
        minWidth: 50,
      },
      {
        key: 'relatedParty',
        header: 'צד קשר',
        type: 'boolean',
        render: (row) => null,
        positionCenter: true,
        minWidth: 50,
      },
      {
        key: 'personalInterest',
        header: 'עניין אישי',
        type: 'boolean',
        render: (row) => null,
        positionCenter: true,
        minWidth: 50,
      },
    )

    return baseColumns
  }, [allSelected, participationData, deselectedIds, selectedCompaniesCount])

  // Form handlers
  const handleFundsSelectionChange = (selected: string[]) => {
    setSelectedFundIds(selected)
    setValidationErrors((prev) => prev.filter((err) => err !== 'companies'))
  }

  const handleRangeChange = (
    newStartDate: Date | undefined,
    newEndDate: Date | undefined,
    type: DateRangeType,
  ) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)
    setRangeType(type)
    if (newStartDate && newEndDate && type) {
      setValidationErrors((prev) => prev.filter((err) => err !== 'dateRange'))
    }
  }

  const handleVoteAgainstRecommendationChange = (checked: boolean) => {
    setVoteAgainstRecommendation(checked)
    setAppliedFilters((prev) => ({
      ...prev,
      voteAgainstRecommendation: checked,
    }))
    setCurrentPage(1)
  }

  const handleVoteDifferentFromResultChange = (checked: boolean) => {
    setVoteDifferentFromResult(checked)
    setAppliedFilters((prev) => ({
      ...prev,
      voteDifferentFromResult: checked,
    }))
    setCurrentPage(1)
  }

  const handleForeignStocksOnlyChange = (checked: boolean) => {
    setForeignStocksOnly(checked)
    setAppliedFilters((prev) => ({
      ...prev,
      foreignStocksOnly: checked,
    }))
    setCurrentPage(1)
  }

  const handleDualMeetingsOnlyChange = (checked: boolean) => {
    setDualMeetingsOnly(checked)
    setAppliedFilters((prev) => ({
      ...prev,
      dualMeetingsOnly: checked,
    }))
    setCurrentPage(1)
  }

  const handleReportNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReportName(e.target.value)
    if (e.target.value.trim()) {
      setValidationErrors((prev) => prev.filter((err) => err !== 'reportName'))
    }
  }

  const handleExportFile = async (format: ExportFormat) => {
    const errors: string[] = []
    if (!reportName.trim()) {
      errors.push('reportName')
    }
    if (!appliedFilters.rangeType) {
      errors.push('dateRange')
    }
    if (selectedFundIds.length === 0) {
      errors.push('companies')
    }
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors([])

    setIsExporting(true)
    try {
      const params = new URLSearchParams({
        companiesIds: selectedCompanyIds.join(','),
        status: 'published',
        export: 'true',
        exportFormat: format,
        reportName: reportName.trim(),
      })

      if (appliedFilters.selectedFundIds.length > 0) {
        params.append('fundIds', appliedFilters.selectedFundIds.join(','))
      }

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

      if (appliedFilters.dualMeetingsOnly) {
        params.append('dualMeetingsOnly', 'true')
      }

      const response = await fetch(`/api/votes/by-companies?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()

      const fileExtension = format === 'excel' ? 'xlsx' : 'pdf'

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportName.trim()}.${fileExtension}`
      document.body.appendChild(a)
      a.click()

      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert('שגיאה בייצוא הקובץ. אנא נסה שוב.')
    } finally {
      setIsExporting(false)
    }
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
                    {participationColumns.map((column) => {
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
                              <div className="truncate cursor-pointer hover:text-blue-600 pr-[25px] w-[50rem]">
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
                            <div>
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
                          content = <BooleanIcon iconType={!agenda.privilegedMajority} />
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
                                  ? '450px'
                                  : '450px'
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

  const showTable = !!appliedFilters.rangeType && selectedCompanyIds.length > 0

  return (
    <div className="p-4 space-y-0 pb-0" dir="rtl">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mr-4 lg:mr-10" dir="rtl">
        {/* Date Range Selector */}
        <div className="w-[300px]">
          <div className="relative pb-5">
            <label className="text-sm text-right whitespace-nowrap">טווח תאריכים</label>
            <DateRangeSelector
              onRangeChangeAction={handleRangeChange}
              className={cn(
                'mt-1 w-full',
                validationErrors.includes('dateRange') && 'border-red-500 ring-1 ring-red-500',
              )}
            />
            {validationErrors.includes('dateRange') && (
              <div className="absolute bottom-0 text-red-500 text-xs text-right">שדה חובה</div>
            )}
          </div>
        </div>

        {/* Company Selector */}
        <div className="w-[300px]">
          <div className="relative pb-5">
            <label className="text-sm text-right whitespace-nowrap">חברות</label>
            <Select>
              <SelectTrigger
                className={cn(
                  'w-full flex-row-reverse justify-between text-right mt-1 h-10',
                  validationErrors.includes('companies') && 'border-red-500 ring-1 ring-red-500',
                )}
              >
                <SelectValue placeholder={getCompanySelectSummary()} />
              </SelectTrigger>
              <SelectContent align="end" dir="rtl" className="p-0">
                <CompanyTreeSelector
                  selectedCompanies={selectedFundIds}
                  onSelectionChangeAction={handleFundsSelectionChange}
                  className="w-full"
                  showSearch={false}
                  allCompaniesIds={companiesWithFunds.flatMap((company) =>
                    company.funds.map((fund) => fund.id),
                  )}
                />
              </SelectContent>
            </Select>
            {validationErrors.includes('companies') && (
              <div className="absolute bottom-0 text-red-500 text-xs text-right">שדה חובה</div>
            )}
          </div>
        </div>

        {/* Report Name */}
        <div className="w-[300px]">
          <div className="relative pb-5">
            <label className="text-sm text-right whitespace-nowrap">שם הדו״ח</label>
            <div className="flex items-center mt-1">
              <Input
                id="report-name"
                type="text"
                value={reportName}
                onChange={handleReportNameChange}
                placeholder="הכנס שם לדו״ח"
                className={cn(
                  'w-full text-right rounded-md border border-input bg-background h-10 shadow-sm',
                  validationErrors.includes('reportName') && 'border-red-500 ring-1 ring-red-500',
                )}
                dir="rtl"
              />
            </div>
            {validationErrors.includes('reportName') && (
              <div className="absolute bottom-0 text-red-500 text-xs text-right">שדה חובה</div>
            )}
          </div>
        </div>

        {/* Export Button */}
        <div className="w-[300px]">
          <div className="relative pb-5">
            <label className="text-sm text-right whitespace-nowrap invisible">ייצוא</label>
            <ExportDropdownButton
              onExportAction={handleExportFile}
              isExporting={isExporting}
              disabled={votesLoading || isExporting}
              className="w-full mt-1 h-10"
            />
          </div>
        </div>
      </div>

      {showTable &&
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
        ) : participationData.length === 0 ? (
          <div className="text-center text-muted-foreground mt-4">
            אין נתונים זמינים עבור הבחירות הנוכחיות.
          </div>
        ) : (
          <div style={{ marginTop: '40px' }}>
            <div className="flex justify-end pr-10 mb-[-25px]">
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
                    מניות חו״ל
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dual-meetings-only"
                    checked={dualMeetingsOnly}
                    onCheckedChange={handleDualMeetingsOnlyChange}
                    className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <Label
                    htmlFor="dual-meetings-only"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-right"
                  >
                    אסיפות דואליות
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
              tableHeightOffset={300}
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
