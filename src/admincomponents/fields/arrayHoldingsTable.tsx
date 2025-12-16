'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import { get } from 'react-hook-form'
import { useMemo, useState } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/app/(frontend)/components/ui/table'
export type ArrayTabelProps = {
  path: string
}

interface StockItem {
  originalData: any
  stockId: string
  accountNum: number
  quantity: number
}

const ArrayHoldingsTableField: React.FC<ArrayTabelProps> = ({ path }) => {
  const { initialData } = useDocumentInfo()
  const data = Array.isArray(get(initialData, path)) ? get(initialData, path) : []
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter((item: StockItem) => {
      const id = String(item?.originalData?.[0]?.stockId ?? '').toLowerCase()
      const qty = String(item?.quantity ?? '').toLowerCase()
      return id.includes(q) || qty.includes(q)
    })
  }, [data, query])
  if (data.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-500 text-center py-4">אין נתונים להצגה</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 overflow-hidden shadow-sm useTw">
      <div className="flex items-center justify-between gap-2 p-2">
        <h3
          className="text-[13px]  text-gray-800 text-right "
          style={{
            fontFamily:
              '-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          אחזקות{' '}
        </h3>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש..."
            className="h-8 w-40 rounded-md border border-gray-300 bg-white px-2 text-sm text-right text-gray-900 placeholder:text-gray-400 caret-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {query && (
            <button
              type="button"
              className="h-8 px-2 rounded-md border text-xs text-gray-600 hover:bg-gray-50"
              onClick={() => setQuery('')}
            >
              נקה
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-64 overflow-y-auto">
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-gray-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">מספר נייר ערך</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">כמות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-sm text-gray-500">
                    אין תוצאות
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item: StockItem, index: number) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {item.originalData?.[0]?.stockId || '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.quantity?.toLocaleString() || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="p-2 text-[11px] text-muted-foreground text-right">
        מציג {filtered.length.toLocaleString()} מתוך {data.length.toLocaleString()} רשומות
      </div>
    </div>
  )
}
export default ArrayHoldingsTableField
