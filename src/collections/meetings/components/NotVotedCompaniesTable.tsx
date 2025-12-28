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
import {
  Download,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Ungroup,
  Group,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotVotedCompaniesTableProps {
  data: any[]
  loading: boolean
  groupBy: boolean
  setGroupBy: (value: boolean) => void
  toggleGroup: (groupId: string) => void
  sort: {
    field: 'nominalValue' | 'percentageHolding' | null
    direction: 'asc' | 'desc'
  }
  handleSort: (field: 'nominalValue' | 'percentageHolding') => void
  exportToCSV: (data: any[], filename: string, columns: any) => void
  companyCount: number
}

export const NotVotedCompaniesTable = ({
  data,
  loading,
  groupBy,
  setGroupBy,
  toggleGroup,
  sort,
  handleSort,
  exportToCSV,
  companyCount,
}: NotVotedCompaniesTableProps) => {
  const columns = {
    company: true,
    nominalValue: true,
    percentageHolding: true,
    hasRelatedStock: true,
  }

  if (loading) {
    return (
      <Card style={{ width: '50%' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">חברות שטרם הצביעו</CardTitle>
              <CardDescription>טוען נתוני חברות...</CardDescription>
            </div>
          </div>
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
    <Card style={{ width: '50%' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">חברות שטרם הצביעו</CardTitle>
            <CardDescription>{companyCount} חברות טרם הצביעו</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span
              style={{
                border: '1px solid rgb(0 0 0 / 0.3)',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer h-9 px-3 shadow-sm',
                groupBy
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 border border-primary'
                  : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
              )}
              onClick={() => {
                setGroupBy(!groupBy)
              }}
            >
              {groupBy ? (
                <>
                  <Ungroup className="h-4 w-4 ml-2" />
                  קיבוץ
                </>
              ) : (
                <>
                  <Group className="h-4 w-4 ml-2" />
                  קיבוץ
                </>
              )}
            </span>
            <span
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer h-9 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm"
              style={{
                border: '1px solid rgb(0 0 0 / 0.3)',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}
              onClick={() => exportToCSV(data, 'companies-not-voted.csv', columns)}
            >
              <Download className="h-4 w-4 ml-2" />
              ייצא CSV
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>חברה</TableHead>
              <TableHead>
                <div
                  className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('nominalValue')}
                >
                  ערך נקוב
                  {sort.field === 'nominalValue' ? (
                    sort.direction === 'asc' ? (
                      <ChevronUp className="h-4 w-4 opacity-100 text-black" />
                    ) : (
                      <ChevronDown className="h-4 w-4 opacity-100 text-black" />
                    )
                  ) : (
                    <ChevronDown className="h-4 w-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead>
                <div
                  className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('percentageHolding')}
                >
                  אחוזים
                  {sort.field === 'percentageHolding' ? (
                    sort.direction === 'asc' ? (
                      <ChevronUp className="h-4 w-4 opacity-100 text-black" />
                    ) : (
                      <ChevronDown className="h-4 w-4 opacity-100 text-black" />
                    )
                  ) : (
                    <ChevronDown className="h-4 w-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead>ניירות עוקבים</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow
                key={item.id}
                className={cn(
                  item.isGroupHeader && 'bg-muted/50 font-semibold',
                  item.isGroupItem && 'bg-muted/20',
                )}
              >
                <TableCell>
                  <div className={cn('flex items-center gap-2', item.isGroupItem && 'mr-6')}>
                    {item.isGroupHeader && (
                      <>
                        <span
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground"
                          onClick={() => toggleGroup(item.id)}
                        >
                          {item.isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                        <Building2 className="h-4 w-4" />
                      </>
                    )}
                    <span className={cn(item.isGroupHeader && 'font-semibold')}>
                      {item.name}
                      {item.passiveFunds && !item.isGroupHeader && (
                        <b className="mr-1"> מחקות בלבד</b>
                      )}
                      {item.isGroupHeader && (
                        <span className="text-base text-muted-foreground mr-2">
                          ({item.subsidiaryCount} חברות)
                          {item.isCollapsed && ' - מכווץ'}
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{item.nominalValue.toLocaleString()}</TableCell>
                <TableCell>{`${item.percentageHolding.toFixed(4)}%`}</TableCell>
                <TableCell>
                  {!item.isGroupHeader && (
                    <span className="text-lg">{item.hasRelatedStock ? '✅' : '❌'}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default NotVotedCompaniesTable
