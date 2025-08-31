'use client'

import { useState, useMemo } from 'react'
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
interface Company {
  id: string
  name: string
  motherCompany?: string
  nominalValue: number
  percentageHolding: number
  hasVoted?: boolean
  hasActualVote?: boolean
  vote?: {
    decision: 'בעד' | 'נגד' | 'נמנע'
    voter: string
    votedAt: string
    notes?: string
    isReported?: boolean
    checksum?: string
  }
}

export const VotingTablesField = () => {
  const { id } = useDocumentInfo()
  const { companies, loading, exportToCSV } = useVotingData()

  // Grouping states
  const [groupByNotVoted, setGroupByNotVoted] = useState(true)
  const [groupByVoted, setGroupByVoted] = useState(true)
  const [collapsedNotVotedGroups, setCollapsedNotVotedGroups] = useState<Set<string>>(new Set())
  const [collapsedVotedGroups, setCollapsedVotedGroups] = useState<Set<string>>(new Set())
  const [collapsedChecksumGroups, setCollapsedChecksumGroups] = useState<Set<string>>(new Set())

  // Sorting states
  const [notVotedSort, setNotVotedSort] = useState<{
    field: 'nominalValue' | 'percentageHolding' | null
    direction: 'asc' | 'desc'
  }>({ field: null, direction: 'asc' })

  const [votedSort, setVotedSort] = useState<{
    field: 'nominalValue' | 'percentageHolding' | 'voteTime' | null
    direction: 'asc' | 'desc'
  }>({ field: null, direction: 'asc' })

  // Generate grouped vote URL for href
  const getGroupedVoteUrl = (item: any) => {
    const motherCompany = item.motherCompany || item.name
    const checksum = item.vote?.checksum
    const groupedCompanies = votedCompanies.filter((company) => {
      const companyMotherCompany = company.motherCompany || company.name
      return companyMotherCompany === motherCompany && company.vote?.checksum === checksum
    })
    const companyIds = groupedCompanies.map((c) => c.id).join(',')
    return `/admin/grouped-votes/?meetingId=${id}&companyIds=${companyIds}`
  }

  // Sorting functions
  const handleNotVotedSort = (field: 'nominalValue' | 'percentageHolding') => {
    // Automatically disable grouping when sorting is applied (like clicking ungroup)
    setGroupByNotVoted(false)
    // Clear any existing collapsed groups when sorting is applied
    setCollapsedNotVotedGroups(new Set())
    setNotVotedSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleVotedSort = (field: 'nominalValue' | 'percentageHolding' | 'voteTime') => {
    // Automatically disable grouping when sorting is applied (like clicking ungroup)
    setGroupByVoted(false)
    // Clear any existing collapsed groups when sorting is applied
    setCollapsedVotedGroups(new Set())
    setCollapsedChecksumGroups(new Set())
    setVotedSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  // Separate companies by voting status
  const notVotedCompanies = useMemo(() => companies.filter((c) => !c.hasVoted), [companies])
  const votedCompanies = useMemo(() => companies.filter((c) => c.hasVoted), [companies])

  // Group toggle functions
  const toggleNotVotedGroup = (groupId: string) => {
    setCollapsedNotVotedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const toggleVotedGroup = (groupId: string) => {
    setCollapsedVotedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  // Process data for grouping (not voted companies)
  const processedNotVotedData = useMemo(() => {
    let processedCompanies = [...notVotedCompanies]

    // Apply sorting if not grouped
    if (!groupByNotVoted && notVotedSort.field) {
      processedCompanies.sort((a, b) => {
        let aValue = a[notVotedSort.field!]
        let bValue = b[notVotedSort.field!]

        if (notVotedSort.direction === 'asc') {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }

    if (!groupByNotVoted) {
      return processedCompanies.map((company) => ({
        ...company,
        isGroupHeader: false,
        isGroupItem: false,
      }))
    }

    const grouped = new Map<string, Company[]>()
    processedCompanies.forEach((company) => {
      const key = company.motherCompany || company.name
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(company)
    })

    const result: any[] = []
    Array.from(grouped.entries()).forEach(([motherCompany, subsidiaries]) => {
      const groupId = `group-${motherCompany}`

      // Sort subsidiaries if sorting is applied
      if (notVotedSort.field) {
        subsidiaries.sort((a, b) => {
          let aValue = a[notVotedSort.field!]
          let bValue = b[notVotedSort.field!]

          if (notVotedSort.direction === 'asc') {
            return aValue - bValue
          } else {
            return bValue - aValue
          }
        })
      }

      // Add group header
      result.push({
        id: groupId,
        name: motherCompany,
        motherCompany,
        nominalValue: subsidiaries.reduce((sum, s) => sum + s.nominalValue, 0),
        percentageHolding: subsidiaries.reduce((sum, s) => sum + s.percentageHolding, 0),
        isGroupHeader: true,
        isGroupItem: false,
        subsidiaryCount: subsidiaries.length,
        companies: subsidiaries,
        isCollapsed: collapsedNotVotedGroups.has(groupId),
      })

      // Add subsidiary companies only if group is not collapsed
      if (!collapsedNotVotedGroups.has(groupId)) {
        subsidiaries.forEach((company) => {
          result.push({
            ...company,
            isGroupHeader: false,
            isGroupItem: true,
          })
        })
      }
    })

    return result
  }, [notVotedCompanies, groupByNotVoted, collapsedNotVotedGroups, notVotedSort])

  // Process data for grouping (voted companies)
  const processedVotedData = useMemo(() => {
    let processedCompanies = [...votedCompanies]

    // Apply sorting if not grouped
    if (!groupByVoted && votedSort.field) {
      processedCompanies.sort((a, b) => {
        let aValue: any
        let bValue: any

        if (votedSort.field === 'voteTime') {
          aValue = a.vote?.votedAt ? new Date(a.vote.votedAt).getTime() : 0
          bValue = b.vote?.votedAt ? new Date(b.vote.votedAt).getTime() : 0
        } else {
          aValue = a[votedSort.field!]
          bValue = b[votedSort.field!]
        }

        if (votedSort.direction === 'asc') {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }

    if (!groupByVoted) {
      return processedCompanies.map((company) => ({
        ...company,
        isGroupHeader: false,
        isGroupItem: false,
      }))
    }

    const result: any[] = []

    // Two-level grouping: first by mother company, then by checksum
    const motherCompanyGroups = new Map<string, Company[]>()
    processedCompanies.forEach((company) => {
      const motherKey = company.motherCompany || company.name
      if (!motherCompanyGroups.has(motherKey)) {
        motherCompanyGroups.set(motherKey, [])
      }
      motherCompanyGroups.get(motherKey)!.push(company)
    })

    // Color palette for checksum groups - moved outside to continue across mother companies
    const colorPalette = ['#F7CFD8', '#A6D6D6', '#8E7DBE', '#A3DC9A']
    let checksumGroupIndex = Math.floor(Math.random() * colorPalette.length) // Start from random position

    Array.from(motherCompanyGroups.entries()).forEach(([motherCompany, companies]) => {
      const motherGroupId = `mother-${motherCompany}`

      // Add mother company group header (first level)
      result.push({
        id: motherGroupId,
        name: motherCompany,
        motherCompany,
        nominalValue: companies.reduce((sum, s) => sum + s.nominalValue, 0),
        percentageHolding: companies.reduce((sum, s) => sum + s.percentageHolding, 0),
        vote: companies[0]?.vote,
        isGroupHeader: true,
        isGroupItem: false,
        isMotherGroup: true,
        subsidiaryCount: companies.length,
        companies: companies,
        isCollapsed: collapsedVotedGroups.has(motherGroupId),
      })

      // Add checksum subgroups only if mother company group is not collapsed
      if (!collapsedVotedGroups.has(motherGroupId)) {
        const checksumGroups = new Map<string, Company[]>()
        companies.forEach((company) => {
          const checksumKey = company.vote?.checksum || 'ללא checksum'
          if (!checksumGroups.has(checksumKey)) {
            checksumGroups.set(checksumKey, [])
          }
          checksumGroups.get(checksumKey)!.push(company)
        })

        Array.from(checksumGroups.entries()).forEach(([checksum, checksumCompanies]) => {
          const checksumGroupId = `checksum-${motherCompany}-${checksum}`
          const groupColor = colorPalette[checksumGroupIndex % colorPalette.length]
          checksumGroupIndex++

          // Sort checksum companies if sorting is applied
          if (votedSort.field) {
            checksumCompanies.sort((a, b) => {
              let aValue: any
              let bValue: any

              if (votedSort.field === 'voteTime') {
                aValue = a.vote?.votedAt ? new Date(a.vote.votedAt).getTime() : 0
                bValue = b.vote?.votedAt ? new Date(b.vote.votedAt).getTime() : 0
              } else {
                aValue = a[votedSort.field!]
                bValue = b[votedSort.field!]
              }

              if (votedSort.direction === 'asc') {
                return aValue - bValue
              } else {
                return bValue - aValue
              }
            })
          }

          // Don't add checksum group header - just show companies with background colors
          checksumCompanies.forEach((company, index) => {
            result.push({
              ...company,
              isGroupHeader: false,
              isGroupItem: true,
              isCompanyItem: true,
              isLastInChecksumGroup: index === checksumCompanies.length - 1,
              isFirstInChecksumGroup: index === 0,
              checksumGroupSize: checksumCompanies.length,
              groupColor: groupColor,
            })
          })
        })
      }
    })

    return result
  }, [votedCompanies, groupByVoted, collapsedVotedGroups, collapsedChecksumGroups, votedSort])

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
                    // Cancel sorting when enabling grouping
                    if (!groupByNotVoted) {
                      setNotVotedSort({ field: null, direction: 'asc' })
                    }
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
                  // Cancel sorting when enabling grouping
                  if (!groupByVoted) {
                    setVotedSort({ field: null, direction: 'asc' })
                  }
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedVotedData.map((item) => {
                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      item.isGroupHeader &&
                        item.isMotherGroup &&
                        !item.isChecksumGroup &&
                        'bg-muted/50 font-semibold',
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
                          item.isChecksumGroup && 'mr-6',
                          item.isCompanyItem && 'mr-12',
                        )}
                      >
                        {item.isGroupHeader && !item.isChecksumGroup && (
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

                    <TableCell>
                      <div className="flex items-center justify-between">
                        {item.nominalValue.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between">
                        {`${item.percentageHolding.toFixed(4)}%`}
                      </div>
                    </TableCell>

                    <TableCell>
                      {!item.isGroupHeader && item.vote?.voter && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {item.vote.voter}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-between">
                        {!item.isGroupHeader && item.vote?.votedAt && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {formatRelativeTime(item.vote.votedAt)}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {!item.isGroupHeader && (
                        <span className="text-lg">{item.vote?.isReported ? '✅' : '❌'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default VotingTablesField
