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
import { fetcher } from '../helpers/utils-data-table'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import type { ParticipationTableDataType } from './types'
import { DataTableServer } from '../components/data-table-server'
import { Checkbox } from '@/components/ui/checkbox'
import { ExportDropdownButton, type ExportFormat } from '../components/export-dropdown-button'
import { createParticipationColumns, renderAgendaRows } from './participationTableConstants'

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

  const participationColumns = useMemo(() => {
    return createParticipationColumns(
      selectedCompaniesCount,
      allSelected,
      participationData,
      deselectedIds,
      setDeselectedIds,
    )
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

  const renderAgendaRowsCallback = useCallback(
    (row: ParticipationTableDataType) => {
      return renderAgendaRows(row, participationColumns, selectedCompaniesCount)
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
          <div style={{ marginTop: '5px' }}>
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
              defaultVisibleColumns={participationColumns.map((col) => col.key)}
              defaultSortDirection={'desc'}
              tableId="participations-table"
              searchOption={true}
              filterOption={false}
              columnsOption={true}
              tableHeightOffset={300}
              isLoading={votesLoading}
              renderExpandedRowContent={renderAgendaRowsCallback}
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
