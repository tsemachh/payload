'use client'

import {
  defaultVisibleColumns,
  createMeetingColumns,
  renderMeetingActions,
} from './meetingTableConstants'
import { DataTableStatic } from '@/components/data-table-client'
import type { CompanyTableDate, MeetingTableDataType } from '../types/meetings'
import useSWR from 'swr'
import { fetcher, postFetcher } from '../helpers/utils-data-table'
import { useSWRWithErrorHandling } from '../helpers/swr-helpers'
import { handleAndNotifyError, handleApiError, notifyError } from '../helpers/error-handler'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { futureDateFilterOptions, pastDateFilterOptions } from './filtersConst'
import { useCompaniesContext } from '../context/companiesContext'
import { checksum } from '@/app/(frontend)/lib/checksum'
import { downloadFileWithErrorHandling } from '../helpers/fetch-helpers'

export function MeetingsTableClient() {
  const { companies, funds } = useCompaniesContext()
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'companies' | 'agenda'>('companies')
  const [isExporting, setIsExporting] = useState(false)
  const [fundPassiveMap, setFundPassiveMap] = useState(new Map())

  // Initialize with all companies and funds selected
  useEffect(() => {
    if (companies.length > 0) {
      const companyIds = companies.map((company) => company.id)
      setSelectedCompanyIds([...companyIds])
    }
  }, [companies])

  useEffect(() => {
    setFundPassiveMap(new Map(funds?.map((fund) => [fund.id, fund.passiveFund]) || []))
  }, [funds])

  // Build API URL with company filter if companies are selected
  const apiUrl = useMemo(() => {
    let url = `/api/meetings/future-meetings`

    if (selectedCompanyIds.length > 0) {
      url += `?companyIds=${selectedCompanyIds.join(',')}`
    }

    return url
  }, [selectedCompanyIds])

  const { data: meetingsResponse, isLoading: isLoadingMeetings } = useSWRWithErrorHandling(
    apiUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorMessage: 'שגיאה בטעינת נתוני האסיפות',
    },
  )

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
  const meetingCheckSum = checksum(JSON.stringify(meetingsForPercentagesQuery?.meetings))

  const swrKeyForPercentages = meetingsForPercentagesQuery
    ? `/api/votes/voting-percentages?${new URLSearchParams({ meetings: meetingCheckSum }).toString()}`
    : null

  const { data: percentagesResponse } = useSWR(
    swrKeyForPercentages && meetingsForPercentagesQuery
      ? [swrKeyForPercentages, meetingsForPercentagesQuery]
      : null,
    ([url, body]: [string, object]) => postFetcher([url, body]),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onError: (error) => {
        handleApiError(error, 'שגיאה בטעינת נתוני אחוזי הצבעה')
        notifyError({ message: 'שגיאה בטעינת נתוני אחוזי הצבעה' })
      },
    },
  )

  const votingPercentagesMap = percentagesResponse?.percentages

  const dataWithPercentages = useMemo(() => {
    if (!meetingsResponse?.data) return []
    if (!votingPercentagesMap) return meetingsResponse?.data

    return meetingsResponse?.data.map((meeting: MeetingTableDataType) => ({
      ...meeting,
      votingPercentage: votingPercentagesMap[meeting.meetingIdPayload]
        ? votingPercentagesMap[meeting.meetingIdPayload].votingPercentage
        : null,
      companies:
        meeting.companies?.map((company) => ({
          ...company,
          funds:
            company.funds?.map((fund) => ({
              ...fund,
              passiveFund: fundPassiveMap.has(fund.id) ? fundPassiveMap.get(fund.id) : false,
            })) || [],
        })) || [],
    }))
  }, [meetingsResponse?.data, votingPercentagesMap, funds])

  const handleCompanySelectionChange = useCallback((selected: string[]) => {
    setSelectedCompanyIds(selected)
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
      if (storedColumns) {
        params.append('columns', storedColumns)
      }
      if (viewMode) {
        params.append('viewMode', viewMode)
      }
      if (params.toString()) {
        exportUrl += `?${params.toString()}`
      }

      const fileName = 'דו״ח השתתפות.xlsx'

      await downloadFileWithErrorHandling(exportUrl, fileName, {
        errorMessage: 'שגיאה בייצוא הקובץ',
        headers: {
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })
    } catch (error) {
      handleAndNotifyError(error, 'שגיאה בייצוא הקובץ')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <DataTableStatic
        data={dataWithPercentages}
        columns={createMeetingColumns(
          {},
          () => {},
          () => {},
          undefined,
          undefined,
          [],
        )}
        createColumnsWithExpand={createMeetingColumns}
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
        showExport={true}
        onExportExcel={handleExportExcel}
        isExporting={isExporting}
        showCompanySelector={true}
        onCompanySelectionChange={handleCompanySelectionChange}
        getCompanySelectSummary={getCompanySelectSummary}
        showViewModeToggle={true}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  )
}
