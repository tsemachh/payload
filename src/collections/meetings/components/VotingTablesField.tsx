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
  Group,
  Ungroup,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDocumentInfo } from '@payloadcms/ui'
import { useVotingData } from '../hooks/useVotingData'
import { formatRelativeTime } from '@/utils/dateUtils'
import ManageMeetingCompanies from './ManageMeetingCompanies'

export const VotingTablesField = () => {
  const { id } = useDocumentInfo()
  const {
    notVotedCompanies,
    votedCompanies,
    processedNotVotedData,
    processedVotedData,
    loading,
    exportToCSV,
    groupByNotVoted,
    setGroupByNotVoted,
    groupByVoted,
    setGroupByVoted,
    toggleNotVotedGroup,
    toggleVotedGroup,
    notVotedSort,
    votedSort,
    handleNotVotedSort,
    handleVotedSort,
  } = useVotingData()

  // Generate grouped vote URL for href
  const getGroupedVoteUrl = (item: any) => {
    const parentCompany = item.parentCompany || item.name
    const checksum = item.vote?.checksum
    const groupedCompanies = votedCompanies.filter((company) => {
      const companyParentCompany = company.parentCompany || company.name
      return companyParentCompany === parentCompany && company.vote?.checksum === checksum
    })
    const companyIds = groupedCompanies.map((c) => c.id).join(',')
    return `/admin/grouped-votes/?meetingId=${id}&companyIds=${companyIds}`
  }

  const notVotedColumns = {
    company: true,
    nominalValue: true,
    percentageHolding: true,
  }

  const votedColumns = {
    company: true,
    nominalValue: true,
    percentageHolding: true,
    voter: true,
    voteTime: true,
    actualVoteAction: true,
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-pulse">טוען נתוני הצבעות...</div>
      </div>
    )
  }

  if (!id) {
    return (
      <div className="p-4 text-center text-gray-500">
        יש לשמור את האסיפה תחילה כדי לראות את ממשק ההצבעות
      </div>
    )
  }

  return (
    <div className="useTw space-y-6 p-6 text-base" dir="rtl">
      {/* Companies that haven't voted */}
      {processedNotVotedData.length ? (
        <Card style={{ width: '40%' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">חברות שטרם הצביעו</CardTitle>
                <CardDescription>{notVotedCompanies.length} חברות טרם הצביעו</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    border: '1px solid rgb(0 0 0 / 0.3)',
                    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                  }}
                  className={cn(
                    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer h-9 px-3 shadow-sm',
                    groupByNotVoted
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 border border-primary'
                      : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                  )}
                  onClick={() => {
                    setGroupByNotVoted(!groupByNotVoted)
                  }}
                >
                  {groupByNotVoted ? (
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
                  onClick={() =>
                    exportToCSV(processedNotVotedData, 'companies-not-voted.csv', notVotedColumns)
                  }
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
                      onClick={() => handleNotVotedSort('nominalValue')}
                    >
                      ערך נקוב
                      {notVotedSort.field === 'nominalValue' ? (
                        notVotedSort.direction === 'asc' ? (
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
                      onClick={() => handleNotVotedSort('percentageHolding')}
                    >
                      אחוזים
                      {notVotedSort.field === 'percentageHolding' ? (
                        notVotedSort.direction === 'asc' ? (
                          <ChevronUp className="h-4 w-4 opacity-100 text-black" />
                        ) : (
                          <ChevronDown className="h-4 w-4 opacity-100 text-black" />
                        )
                      ) : (
                        <ChevronDown className="h-4 w-4 opacity-30" />
                      )}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedNotVotedData.map((item) => (
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
                              onClick={() => toggleNotVotedGroup(item.id)}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <></>
      )}

      {/* Companies that voted */}
      <Card style={{ width: '75%' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">חברות שהצביעו</CardTitle>
              <CardDescription>{votedCompanies.length} חברות הצביעו</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span
                style={{
                  border: '1px solid rgb(0 0 0 / 0.3)',
                  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                }}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer h-9 px-3 shadow-sm',
                  groupByVoted
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 border border-primary'
                    : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                )}
                onClick={() => {
                  setGroupByVoted(!groupByVoted)
                }}
              >
                {groupByVoted ? (
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
                onClick={() => exportToCSV(processedVotedData, 'companies-voted.csv', votedColumns)}
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
                    onClick={() => handleVotedSort('nominalValue')}
                  >
                    ערך נקוב
                    {votedSort.field === 'nominalValue' ? (
                      votedSort.direction === 'asc' ? (
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
                    onClick={() => handleVotedSort('percentageHolding')}
                  >
                    אחוזים
                    {votedSort.field === 'percentageHolding' ? (
                      votedSort.direction === 'asc' ? (
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
                    onClick={() => handleVotedSort('voteTime')}
                  >
                    זמן הצבעה (יחסי)
                    {votedSort.field === 'voteTime' ? (
                      votedSort.direction === 'asc' ? (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedVotedData.map((item) => {
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
                              onClick={() => toggleVotedGroup(item.id)}
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
                                <span>{item.name}</span>
                              </a>
                            ) : (
                              <span>{item.name}</span>
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
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ManageMeetingCompanies />
    </div>
  )
}

export default VotingTablesField
