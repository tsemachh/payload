'use client'

import {
  defaultVisibleColumns,
  meetingColumns,
  renderMeetingActions,
} from './meetingTableConstants'
import { DataTableStatic } from '@/components/data-table-client'
import { CompanyTableDate, MeetingTableDataType } from '../types/meetings'
import useSWR from 'swr'
import { fetcher, postFetcher } from '../helpers/utils-data-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { futureDateFilterOptions, pastDateFilterOptions } from './filtersConst'
import { useCompaniesContext } from '../context/companiesContext'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompanyTreeSelector } from '../holdings/components/CompanySelector'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function MeetingsTableClient() {
  const { companies, funds } = useCompaniesContext()
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'companies' | 'agenda'>('companies')

  // Initialize with all companies and funds selected
  useEffect(() => {
    if (companies.length > 0 || funds.length > 0) {
      const companyIds = companies.map((company) => company.id)
      const fundIds = funds.map((fund) => fund.id)
      setSelectedCompanyIds([...companyIds, ...fundIds])
    }
  }, [companies, funds])

  // Build API URL with company filter if companies are selected
  const apiUrl = useMemo(() => {
    let url = `/api/meetings/future-meetings`

    if (selectedCompanyIds.length > 0) {
      url += `?fundIds=${selectedCompanyIds.join(',')}`
    }

    return url
  }, [selectedCompanyIds])

  const { data: meetingsResponse, isLoading: isLoadingMeetings } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
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
    : null

  const { data: percentagesResponse } = useSWR(swrKeyForPercentages, postFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

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
  }, [])

  const getCompanySelectSummary = () => {
    if (selectedCompanyIds.length === 0) {
      return 'בחר חברות'
    }

    const totalCompanyIds = companies.map((company) => company.id)
    const totalFundIds = funds.map((fund) => fund.id)
    const allIds = [...totalCompanyIds, ...totalFundIds]

    const allSelected =
      selectedCompanyIds.length === allIds.length &&
      selectedCompanyIds.every((id) => allIds.includes(id))

    if (allSelected) {
      return 'נבחרו הכל'
    }

    return `נבחרו ${selectedCompanyIds.length} חברות`
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-row justify-start gap-4 mr-10 mb-4"
        style={{ position: 'absolute', left: '400px', top: '128px' }}
      >
        <div className="w-[300px]">
          <div className="flex items-center gap-3">
            <label className="text-base font-semibold text-right whitespace-nowrap">חברות</label>
            <Select>
              <SelectTrigger className="w-[250px] flex-row-reverse justify-between text-right">
                <SelectValue placeholder={getCompanySelectSummary()} />
              </SelectTrigger>
              <SelectContent align="end" dir="rtl" className="p-0">
                <CompanyTreeSelector
                  selectedCompanies={selectedCompanyIds}
                  onSelectionChangeAction={handleCompanySelectionChange}
                  className="w-full"
                  showSearch={true}
                  allCompaniesIds={[
                    ...companies.map((company) => company.id),
                    ...funds.map((fund) => fund.id),
                  ]}
                />
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as 'companies' | 'agenda')}
            variant="outline"
            className="bg-background"
          >
            <ToggleGroupItem value="companies" className="text-sm font-medium px-4">
              הצג חברות
            </ToggleGroupItem>
            <ToggleGroupItem value="agenda" className="text-sm font-medium px-4">
              הצג סדר יום
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <DataTableStatic
        data={dataWithPercentages}
        columns={meetingColumns}
        isLoading={isLoadingMeetings}
        idField="meetingId"
        defaultSortField={'meetingDate' as keyof MeetingTableDataType}
        defaultSortDirection="asc"
        tableId="meetings-table"
        renderRowActions={renderMeetingActions}
        pastDateFilterOptions={pastDateFilterOptions}
        futureDateFilterOptions={futureDateFilterOptions}
        onlyFuture={true}
        searchPlaceholder="חיפוש בכל השדות..."
        defaultVisibleColumns={defaultVisibleColumns}
        tableHeightOffset={200}
        displayMode={viewMode as 'companies' | 'agenda'}
      />
    </div>
  )
}
