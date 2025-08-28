'use client'

import {
  defaultVisibleColumns,
  meetingColumns,
  renderMeetingActions,
} from './meetingTableConstants'
import { DataTableStatic } from '@/components/data-table-client'
import type { CompanyTableDate, MeetingTableDataType } from '../types/meetings'
import useSWR from 'swr'
import { fetcher, postFetcher } from '../helpers/utils-data-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { futureDateFilterOptions, pastDateFilterOptions } from './filtersConst'
import { useCompaniesContext } from '../context/companiesContext'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompanyTreeSelector } from '../holdings/components/CompanySelector'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet } from 'lucide-react'

export function MeetingsTableClient() {
  const { companies, funds } = useCompaniesContext()
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'companies' | 'agenda'>('companies')
  const [isExporting, setIsExporting] = useState(false)
  // Initialize with all companies and funds selected
  useEffect(() => {
    if (companies.length > 0 || funds.length > 0) {
      const companyIds = companies.map((company) => company.id)
      const fundIds = funds.map((fund) => fund.id)
      setSelectedCompanyIds([...companyIds])
    }
  }, [companies, funds])

  // Build API URL with company filter if companies are selected
  const apiUrl = useMemo(() => {
    let url = `/api/meetings/future-meetings`

    if (selectedCompanyIds.length > 0) {
      url += `?companyIds=${selectedCompanyIds.join(',')}`
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

    const totalFundIds = funds.map((fund) => fund.id)
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

  const commonButtonClasses = 'px-3 py-1 text-xs rounded-full transition-all'

  const getButtonClasses = (isSelected: boolean) => {
    const selectedStyle = 'bg-primary text-primary-foreground shadow-sm'
    const unselectedStyle = 'text-muted-foreground hover:bg-muted-foreground/10'
    return `${commonButtonClasses} ${isSelected ? selectedStyle : unselectedStyle}`
  }

  const handleExportExcel = async () => {
    setIsExporting(true)

    try {
      let exportUrl = `/api/meetings/future-meetings`
      const params = new URLSearchParams()

      if (selectedCompanyIds.length > 0) {
        params.append('companyIds', selectedCompanyIds.join(','))
      }

      // Add export parameter
      params.append('export', 'true')
      const storedColumns = localStorage.getItem(`columnVisibility-${'meetings-table'}`)
      console.log('storedColumns', storedColumns)
      if (storedColumns) {
        params.append('columns', storedColumns)
      }
      if (viewMode) {
        params.append('viewMode', viewMode)
      }
      if (params.toString()) {
        exportUrl += `?${params.toString()}`
      }
      // Make API call to get export data
      const response = await fetch(exportUrl)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'דו"ח השתתפות באסיפות.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('הקובץ הורד בהצלחה!')
    } catch (error) {
      console.error('Export failed:', error)
      alert('הייתה שגיאה בהורדת הקובץ')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-row justify-start gap-4 mr-10 mb-4"
        style={{ position: 'absolute', left: '400px', top: '128px' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex bg-muted rounded-full p-0.5 mr-2">
            <button
              type="button"
              onClick={() => setViewMode('companies')}
              className={getButtonClasses(viewMode === 'companies')}
            >
              חברות
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={getButtonClasses(viewMode === 'agenda')}
            >
              סדר יום
            </button>
          </div>
        </div>

        {/* COMPANY SELECTOR */}
        <div className=" flex w-[300px] -mr-14 -ml-6 ">
          <div className="flex items-center gap-3 mr-[50px]">
            <Select>
              <SelectTrigger className="w-[250px] flex-row-reverse justify-between text-right h-8 mt-[3px]">
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
        displayMode={viewMode}
        selectedCompanyIds={selectedCompanyIds}
      />

      <div className="mt-4 flex justify-end pl-4">
        <Button
          onClick={handleExportExcel}
          variant="default"
          className="rounded-md whitespace-nowrap ml-4"
          disabled={isExporting}
        >
          {isExporting ? 'מייצא...' : 'ייצוא כקובץ Excel'}
          <FileSpreadsheet className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
