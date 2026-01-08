'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { get } from 'react-hook-form'
import { useMemo, useState, useEffect } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/app/(frontend)/components/ui/table'
import { format } from 'date-fns'

export type ArrayTableProps = {
  path: string
}

interface HistoricalHoldingItem {
  company: string
  fund: string
  lastHoldingDate: string
  quantity: number
  original?: {
    stockId: string
    accountNum: number
    quantity: number
  }[]
}

const HistoricalHoldingsTableField: React.FC<ArrayTableProps> = ({ path }) => {
  const { initialData } = useDocumentInfo()
  const data = (
    Array.isArray(get(initialData, path)) ? get(initialData, path) : []
  ) as HistoricalHoldingItem[]
  const [query, setQuery] = useState('')
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchCompanyNames = async () => {
      const ids = new Set<string>()
      data.forEach((item) => {
        if (item.fund) ids.add(item.fund)
        if (item.company) ids.add(item.company)
      })

      const idsToFetch = Array.from(ids).filter((id) => !companyNames[id])

      if (idsToFetch.length === 0) return

      try {
        const response = await fetch('/api/companies/get-company-names', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ companyids: idsToFetch }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && Array.isArray(result.data)) {
            const newNames = { ...companyNames }
            result.data.forEach((c: { id: string; name: string }) => {
              newNames[c.id] = c.name
            })
            setCompanyNames(newNames)
          }
        }
      } catch (error) {
        console.error('Error fetching company names:', error)
      }
    }

    if (data.length > 0) {
      fetchCompanyNames()
    }
  }, [data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter((item: HistoricalHoldingItem) => {
      const fundId = String(item?.fund ?? '').toLowerCase()
      const fundName = String(companyNames[item?.fund] ?? '').toLowerCase()
      const companyId = String(item?.company ?? '').toLowerCase()
      const companyName = String(companyNames[item?.company] ?? '').toLowerCase()

      return (
        fundId.includes(q) ||
        fundName.includes(q) ||
        companyId.includes(q) ||
        companyName.includes(q)
      )
    })
  }, [data, query, companyNames])

  // No early return for empty data to ensure label is always shown
  return (
    <div className="bg-white border border-gray-200 overflow-hidden shadow-sm useTw">
      <div className="flex items-center justify-between gap-2 p-2">
        <h3
          className="text-[13px] text-gray-800 text-right"
          style={{
            fontFamily:
              '-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          החזקות היסטוריות
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
        <div className="max-h-[346px] overflow-y-auto">
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-gray-50">
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider text-right">תיק</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">חברה</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">כמות</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  תאריך החזקה אחרון
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">
                  החזקה מקורית
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-gray-500 py-8">
                    אין נתונים להצגה
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                    אין תוצאות
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item: HistoricalHoldingItem, index: number) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      <div className="flex flex-col">
                        <span>{companyNames[item.fund] || '-'}</span>
                        <span className="text-[10px] text-gray-400">{item.fund}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-900 text-right">
                      <div className="flex flex-col">
                        <span>{companyNames[item.company] || '-'}</span>
                        <span className="text-[10px] text-gray-400">{item.company}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.quantity?.toLocaleString() || '0'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.lastHoldingDate
                        ? format(new Date(item.lastHoldingDate), 'dd/MM/yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-900 text-right">
                      {item.original && item.original.length > 0 ? (
                        <div className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.original.map((od, i) => (
                            <div key={i} className="text-[10px] leading-tight">
                              {od.stockId}: {od.quantity?.toLocaleString()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
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

export default HistoricalHoldingsTableField
