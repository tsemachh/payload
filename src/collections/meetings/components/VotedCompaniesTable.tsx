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
  Clock,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Ungroup,
  Group,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/utils/dateUtils'

interface VotedCompaniesTableProps {
  data: any[]
  loading: boolean
  groupBy: boolean
  setGroupBy: (value: boolean) => void
  toggleGroup: (groupId: string) => void
  sort: {
    field: 'nominalValue' | 'percentageHolding' | 'voteTime' | null
    direction: 'asc' | 'desc'
  }
  handleSort: (field: 'nominalValue' | 'percentageHolding' | 'voteTime') => void
  exportToCSV: (data: any[], filename: string, columns: any) => void
  companyCount: number
  getGroupedVoteUrl: (item: any) => string | undefined
}

export const VotedCompaniesTable = ({
  data,
  loading,
  groupBy,
  setGroupBy,
  toggleGroup,
  sort,
  handleSort,
  exportToCSV,
  companyCount,
  getGroupedVoteUrl,
}: VotedCompaniesTableProps) => {
  const columns = {
    company: true,
    nominalValue: true,
    percentageHolding: true,
    voter: true,
    voteTime: true,
    actualVoteAction: true,
    hasRelatedStock: true,
  }

  if (loading) {
    return (
      <Card style={{ width: '75%' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">חברות שהצביעו</CardTitle>
              <CardDescription>טוען נתוני הצבעות...</CardDescription>
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

  return (
    <Card style={{ width: '75%' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">חברות שהצביעו</CardTitle>
            <CardDescription>{companyCount} חברות הצביעו</CardDescription>
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
              onClick={() => exportToCSV(data, 'companies-voted.csv', columns)}
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
              <TableHead>מצביע</TableHead>
              <TableHead>
                <div
                  className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('voteTime')}
                >
                  זמן הצבעה (יחסי)
                  {sort.field === 'voteTime' ? (
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
              <TableHead>הצבעה בפועל</TableHead>
              <TableHead>ניירות עוקבים</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
              return (
                <TableRow
                  key={item.id}
                  className={cn(
                    item.isGroupHeader && item.isParentGroup && 'bg-muted/50 font-semibold',
                  )}
                  style={{
                    backgroundColor: item.groupColor ? `${item.groupColor}40` : undefined,
                  }}
                >
                  <TableCell>
                    <div
                      className={cn(
                        'flex items-center gap-2',
                        item.isGroupItem && !item.isGroupHeader && 'mr-6',
                        item.isCompanyItem && 'mr-12',
                      )}
                    >
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
                          <span className="font-semibold">
                            {item.name}
                            <span className="text-base text-muted-foreground mr-2">
                              ({item.subsidiaryCount} חברות)
                              {item.isCollapsed && ' - מכווץ'}
                            </span>
                          </span>
                        </>
                      )}

                      {!item.isGroupHeader && (
                        <>
                          {item.isCompanyItem && item.vote ? (
                            <a
                              href={getGroupedVoteUrl(item)}
                              className="flex items-center gap-2 text-inherit no-underline hover:no-underline cursor-pointer hover:text-blue-600"
                              title="פתח דף הצבעה קבוצתי"
                            >
                              <span>
                                {item.name}
                                {item.passiveFunds && <b className="mr-1"> מחקות בלבד</b>}
                              </span>
                            </a>
                          ) : (
                            <span>
                              {item.name}
                              {item.passiveFunds && <b className="mr-1"> מחקות בלבד</b>}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>{item.nominalValue.toLocaleString()}</TableCell>
                  <TableCell>{`${item.percentageHolding.toFixed(4)}%`}</TableCell>

                  <TableCell>
                    {!item.isGroupHeader && item.vote?.voter && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {item.vote.voter}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    {!item.isGroupHeader && item.vote?.votedAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatRelativeTime(item.vote.votedAt)}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    {!item.isGroupHeader && (
                      <span className="text-lg">{item.vote?.reported ? '✅' : '❌'}</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {!item.isGroupHeader && (
                      <span className="text-lg">{item.hasRelatedStock ? '✅' : '❌'}</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default VotedCompaniesTable
