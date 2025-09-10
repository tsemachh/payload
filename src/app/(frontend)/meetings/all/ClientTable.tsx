'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataTableServer } from '@/components/data-table-server'
import { meetingColumns, renderMeetingActions } from '../meetingTableConstants'
import { CompanyTableDate, DateFilterType, MeetingTableDataType } from '../../types/meetings'
import { fetcher, postFetcher } from '../../helpers/utils-data-table'
import { useSWRWithErrorHandling } from '../../helpers/swr-helpers'
import { futureDateFilterOptions, pastDateFilterOptions } from '../filtersConst'
import { useCompaniesContext } from '../../context/companiesContext'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompanyTreeSelector } from '../../holdings/components/CompanySelector'
import useSWR from 'swr'

export function MeetingsTableServer() {
  const { companies, funds } = useCompaniesContext()
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortField, setSortField] = useState<string>('meetingDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [dateFilters, setDateFilters] = useState<Record<string, DateFilterType>>({})

  // Initialize with all companies and funds selected
  useEffect(() => {
    if (companies.length > 0 || funds.length > 0) {
      const companyIds = companies.map((company) => company.id)
      setSelectedCompanyIds([...companyIds])
    }
  }, [companies, funds])

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      pageSize: pageSize.toString(),
      sortField,
      sortDirection,
      search: searchTerm,
    })

    // Add company filter if companies are selected
    if (selectedCompanyIds.length > 0) {
      params.append('companyIds', selectedCompanyIds.join(','))
    }

    // Add regular filters
    Object.entries(filters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        params.append(`filter_${key}`, JSON.stringify(values))
      }
    })

    // Add date filters
    Object.entries(dateFilters).forEach(([key, filter]) => {
      if (filter.past || filter.future || !filter.empty || filter.custom) {
        params.append(`dateFilter_${key}`, JSON.stringify(filter))
      }
    })

    return `/api/meetings/all-meetings?${params.toString()}`
  }, [
    currentPage,
    pageSize,
    sortField,
    sortDirection,
    searchTerm,
    filters,
    dateFilters,
    selectedCompanyIds,
  ])

  const { data: meetingsResponse, isLoading } = useSWRWithErrorHandling(query, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    errorMessage: 'שגיאה בטעינת נתוני הישיבות',
  })

  const meetingsForPercentagesQuery = useMemo(() => {
    if (!meetingsResponse?.data || meetingsResponse?.data.length === 0) {
      return null
    }

    const meetingsPayload = meetingsResponse?.data.map((meeting: MeetingTableDataType) => ({
      meetingId: meeting.meetingIdPayload,
      companyIds: meeting.companies.map((company: CompanyTableDate) => company.id),
    }))

    return { meetings: meetingsPayload }
  }, [meetingsResponse?.data])

  const swrKeyForPercentages = meetingsForPercentagesQuery
    ? ['/api/votes/voting-percentages', meetingsForPercentagesQuery]
    : []

  const { data: percentagesResponse } = useSWR(
    swrKeyForPercentages && meetingsForPercentagesQuery ? [swrKeyForPercentages, meetingsForPercentagesQuery] : null,
    ([url, body]: [string, object]) => postFetcher([url, body]),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorMessage: 'שגיאה בטעינת נתוני אחוזי הצבעה',
    },
  )

  const votingPercentagesMap = percentagesResponse?.percentages

  const dataWithPercentages = useMemo(() => {
    if (!meetingsResponse?.data) return []

    if (!votingPercentagesMap) return meetingsResponse?.data

    return meetingsResponse?.data.map((meeting: MeetingTableDataType) => {
      const percentageData = votingPercentagesMap[meeting.meetingIdPayload]
      return {
        ...meeting,
        votingPercentage: percentageData ? percentageData.votingPercentage : null,
      }
    })
  }, [meetingsResponse?.data, votingPercentagesMap])

  const handleCompanySelectionChange = useCallback((selected: string[]) => {
    setSelectedCompanyIds(selected)
    setCurrentPage(1) // reset to first page when companies change
  }, [])

  const getCompanySelectSummary = () => {
    if (selectedCompanyIds.length === 0) {
      return 'בחר חברות'
    }

    const totalCompaniesIds = companies.map((com) => com.id)
    const allIds = [...totalCompaniesIds]
    const allSelected =
      selectedCompanyIds.length === allIds.length &&
      selectedCompanyIds.every((id) => allIds.includes(id))

    if (allSelected) {
      return 'נבחרו כל החברות'
    }

    return `נבחרו ${selectedCompanyIds.length} חברות`
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1) // reset to first page
  }

  const handleSort = (field: string) => {
    const newDirection = field === sortField ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
    setSortField(field)
    setSortDirection(newDirection)
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1) // reset to first page
  }

  const handleFilter = (field: string, values: string[]) => {
    setFilters((prev) => ({
      ...prev,
      [field]: values,
    }))
    setCurrentPage(1) // reset to first page
  }

  const handleDateFilter = (field: string, filter: DateFilterType) => {
    setDateFilters((prev) => ({
      ...prev,
      [field]: filter,
    }))
    setCurrentPage(1) // reset to first page
  }

  return (
    <div className="space-y-4">
      {/* COMPANY SELECTOR */}
      <div className="absolute mr-[50.5rem] mt-[1.2rem] ">
        <div className="flex items-center">
          <Select>
            <SelectTrigger className="w-64 flex-row-reverse justify-between text-right h-8">
              <SelectValue placeholder={getCompanySelectSummary()} />
            </SelectTrigger>
            <SelectContent align="end" dir="rtl" className="p-0">
              <CompanyTreeSelector
                selectedCompanies={selectedCompanyIds}
                showSearch={false}
                onSelectionChangeAction={handleCompanySelectionChange}
                className="w-full"
                allCompaniesIds={[...companies.map((com) => com.id)]}
                showFunds={false}
              />
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTableServer
        data={dataWithPercentages}
        columns={meetingColumns}
        idField="meetingId"
        defaultSortField={sortField as keyof MeetingTableDataType}
        defaultSortDirection={sortDirection}
        tableId="meetings-table"
        renderRowActions={renderMeetingActions}
        pagination={{
          pageSize,
          totalItems: meetingsResponse?.totalItems || 0,
          totalPages: meetingsResponse?.totalPages || 0,
          currentPage,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions: [10, 25, 50, 100, 500, 1000],
        }}
        isLoading={isLoading}
        onServerSort={handleSort}
        onServerSearch={handleSearch}
        onServerFilter={handleFilter}
        onServerDateFilter={handleDateFilter}
        initialSearchTerm={searchTerm}
        searchPlaceholder="חיפוש בשדות הטקסט והמספרים..."
        serverSideProcessing={true}
        pastDateFilterOptions={pastDateFilterOptions}
        futureDateFilterOptions={futureDateFilterOptions}
        selectedCompanyIds={selectedCompanyIds}
      />
    </div>
  )
}
