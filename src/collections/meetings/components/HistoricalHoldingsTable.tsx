'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useState } from 'react'

interface HistoricalHoldingsTableProps {
  data: any[]
  loading: boolean
}

export const HistoricalHoldingsTable = ({ data, loading }: HistoricalHoldingsTableProps) => {
  const [hoveredHistoricalRow, setHoveredHistoricalRow] = useState<string | null>(null)

  if (loading) {
    return (
      <Card style={{ width: '60%' }}>
        <CardHeader>
          <CardTitle className="text-lg">חברות שלא מזומנות לאסיפה עם הסטוריית החזקות</CardTitle>
          <CardDescription>טוען נתוני החזקות היסטוריות...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data.length) {
    return <></>
  }

  return (
    <Card style={{ width: '60%' }}>
      <CardHeader>
        <CardTitle className="text-lg">חברות שלא מזומנות לאסיפה עם הסטוריית החזקות</CardTitle>
        <CardDescription>
          חברות שהחזיקו בנייר 30 יום לפני המועד הקובע אך לא מזומנות לאסיפה ({data.length} חברות)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם חברה</TableHead>
                <TableHead>תאריך החזקה אחרון</TableHead>
                <TableHead>כמות החזקה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((holding) => (
                <TableRow
                  key={holding.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors relative"
                  onMouseEnter={() => setHoveredHistoricalRow(holding.id)}
                  onMouseLeave={() => setHoveredHistoricalRow(null)}
                >
                  <TableCell>{holding.companyName}</TableCell>
                  <TableCell>
                    {holding.lastHoldingDate
                      ? new Date(holding.lastHoldingDate).toLocaleDateString('he-IL')
                      : '-'}
                  </TableCell>
                  <TableCell>{holding.quantity.toLocaleString()}</TableCell>

                  {/* Fund Details Tooltip */}
                  {hoveredHistoricalRow === holding.id && holding.fundDetails.length > 0 && (
                    <div
                      className="absolute z-50 p-3 bg-white border border-gray-300 rounded-md shadow-lg"
                      style={{
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        minWidth: '400px',
                        maxWidth: '600px',
                      }}
                    >
                      <div className="space-y-1">
                        {holding.fundDetails.map((fund: any, index: number) => (
                          <div
                            key={fund.fundId}
                            className={`grid grid-cols-[2fr_1fr_1fr] gap-2 items-center py-1 ${
                              index !== holding.fundDetails.length - 1
                                ? 'border-b border-gray-200'
                                : ''
                            }`}
                          >
                            <div className="font-medium text-sm">{fund.fundName}</div>

                            <div className="text-sm text-gray-600">
                              {fund.lastHoldingDate
                                ? new Date(fund.lastHoldingDate).toLocaleDateString('he-IL')
                                : '-'}
                            </div>

                            <div className="text-sm text-gray-600">
                              {fund.quantity.toLocaleString()}
                            </div>
                          </div>
                        ))}

                        {/* שורה של סה"כ, משתלבת בתוך הטבלה */}
                        {holding.fundDetails.length > 1 && (
                          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 items-center pt-2 border-t border-gray-200 font-semibold text-sm">
                            <div className="col-span-2 text-right">סה״כ:</div>
                            <div>{holding.quantity.toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default HistoricalHoldingsTable
