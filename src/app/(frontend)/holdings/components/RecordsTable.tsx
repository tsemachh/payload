'use client'

import React, { useState } from 'react'
import { Column } from '../../types/meetings'
import { DataTableStatic } from '@/components/data-table-client'
import { HoldingFeedLine } from '@/payload-types'
import { SilenceDialog } from './SilenceDialog'
import { AddSubAccountDialog } from './AddSubAccountDialog'
import { HoldingFeedLineWithName } from '@/collections/holdings/feeds/FeedValidations'
import { formatNumberWithLocale } from '@/utils/numberUtils'
import { Button } from '@/components/ui/button'

interface RecordType {
  lineNumber: string | number
  stockId: string | number
  accountId: string | number
  companyName?: string | null
  quantity: string | number
  error: string
  id?: string | number
  stockName: string
}

const holdingColumns: Column<RecordType>[] = [
  {
    key: 'lineNumber',
    header: 'שורה',
    type: 'string',
    minWidth: 50,
    width: 50,
  },
  {
    key: 'stockName',
    header: 'נייר ערך',
    type: 'string',
    minWidth: 70,
    width: 130,
    render: (row) => `${row.stockId ?? 'N/A'} - ${row.stockName ?? 'N/A'}`,
  },
  {
    key: 'accountId',
    header: 'חשבון',
    type: 'string',
    filterable: true,
    minWidth: 60,
    width: 60,
  },
  {
    key: 'companyName',
    header: 'חברה',
    type: 'string',
    filterable: true,
    minWidth: 70,
    width: 130,
  },
  {
    key: 'quantity',
    header: 'כמות',
    type: 'number',
    width: 60,
    minWidth: 60,
    render: (row) => formatNumberWithLocale(Number(row.quantity) || 0, 0, 'he-IL'),
  },
]

const getInvalidColumnsAdditional = (
  companies: string[],
  allRecords: HoldingFeedLine[],
  onRefresh: (records: any[]) => void,
  selectedStockIds: Set<string | number>,
  onStockSelection: (stockId: string | number) => void,
): Column<RecordType>[] => [
  {
    key: 'error',
    header: 'שגיאה',
    type: 'string',
    width: 100,
    minWidth: 120,
    filterable: true,
    render: (row) => {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{row.error}</span>

          {(row.error === 'נייר ערך לא מוכר' || row.error === 'נייר ערך לא פעיל') && (
            <Button
              variant="outline"
              size="sm"
              className={`mr-[24px] w-[60px] bg-transparent border border-inherit hover:bg-muted transition-colors ${
                selectedStockIds.has(row.stockId)
                  ? 'text-primary border-primary bg-primary/10 hover:text-dark'
                  : 'text-dark hover:text-dark'
              }`}
              onClick={() => onStockSelection(row.stockId)}
            >
              השתקה
            </Button>
          )}

          {row.error === 'מספר חשבון לא מוכר' && (
            <AddSubAccountDialog
              accountId={row.accountId}
              companies={companies}
              allRecords={allRecords}
              onRefreshAction={onRefresh}
            />
          )}
        </div>
      )
    },
  },
]

export const RecordsTable: React.FC<{
  records: HoldingFeedLineWithName[]
  invalid?: boolean
  companies: string[]
  onRefresh?: (records: HoldingFeedLine[]) => void
  valid?: HoldingFeedLine[]
  silenced?: HoldingFeedLine[]
}> = ({ records, invalid, companies, onRefresh, valid, silenced }) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string | number>>(new Set())
  const [silenceDialogOpen, setSilenceDialogOpen] = useState(false)

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Handle stock selection for silencing
  const handleStockSelection = (stockId: string | number) => {
    const newSelected = new Set(selectedStockIds)
    if (newSelected.has(stockId)) {
      newSelected.delete(stockId)
    } else {
      newSelected.add(stockId)
    }
    setSelectedStockIds(newSelected)
  }

  // Handle bulk silence action
  const handleBulkSilence = () => {
    if (selectedStockIds.size > 0) {
      setSilenceDialogOpen(true)
    }
  }

  // Handle refresh after silencing
  const handleRefreshAfterSilence = (records: HoldingFeedLine[]) => {
    setSelectedStockIds(new Set()) // Clear selection
    if (onRefresh) {
      onRefresh(records)
    }
  }

  // Handle dialog close - closes dialog and clears selection
  const handleDialogClose = () => {
    setSilenceDialogOpen(false)
    setSelectedStockIds(new Set())
  }

  const dataWithIds: RecordType[] = records.map((holding, index) => ({
    id: index + 1,
    lineNumber: holding.lineNumber ?? 'N/A',
    stockId: holding.stockId ?? 'N/A',
    stockName: holding.stockName ?? 'N/A',
    accountId: holding.accountId ?? 'N/A',
    companyName: holding.companyName ?? 'N/A',
    quantity: holding.quantity ?? 'N/A',
    error: holding.error ?? ' ',
  }))

  const allRecords = [...records, ...(valid ?? []), ...(silenced ?? [])]
  const columns =
    invalid && onRefresh
      ? [
          ...holdingColumns,
          ...getInvalidColumnsAdditional(
            companies,
            allRecords,
            onRefresh,
            selectedStockIds,
            handleStockSelection,
          ),
        ]
      : holdingColumns

  const tableWidth = columns.reduce((sum, column) => {
    return sum + (column.width || column.minWidth) + 25
  }, 0)

  return (
    <div>
      <div
        style={{
          maxHeight: `${window.innerHeight - 300}px`,
          minWidth: tableWidth + 50 + 'px',
          maxWidth: tableWidth + 80 + columns.length * 100 + 'px',
          width: '100%',
          //        margin: '0 auto',
        }}
      >
        <DataTableStatic
          data={dataWithIds}
          columns={columns}
          idField="id"
          defaultSortField="lineNumber"
          defaultSortDirection="asc"
          tableId={invalid ? 'holdings-table-invalid' : 'holdings-table'}
          columnsOption={false}
          tableHeightOffset={400}
          pagination={{
            pageSize: 100,
            currentPage: currentPage,
            onPageChange: handlePageChange,
          }}
        />
      </div>

      {/* Bulk Actions Bar */}
      {invalid && selectedStockIds.size > 0 && (
        <div className="mt-4 p-3 bg-muted rounded-lg border ms-10 w-1/2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm">נבחרו {selectedStockIds.size} ניירות ערך להשתקה:</span>
            <span className="text-xs">{Array.from(selectedStockIds).join(', ')}</span>
            <div className="flex gap-2 mr-auto">
              <Button variant="outline" size="sm" onClick={() => setSelectedStockIds(new Set())}>
                ביטול
              </Button>
              <Button variant="default" size="sm" onClick={handleBulkSilence}>
                שלח השתקות
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Silence Dialog */}
      {invalid && onRefresh && (
        <SilenceDialog
          stockIds={Array.from(selectedStockIds)}
          companies={companies}
          allRecords={allRecords}
          onRefreshAction={handleRefreshAfterSilence}
          open={silenceDialogOpen}
          onClose={handleDialogClose}
        />
      )}
    </div>
  )
}
