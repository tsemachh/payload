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
  Plus,
  Trash2,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDocumentInfo } from '@payloadcms/ui'
import { useVotingData } from '../hooks/useVotingData'
import { formatRelativeTime } from '@/utils/dateUtils'
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/(frontend)/components/ui/dialog'
import { Button } from '@/app/(frontend)/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/(frontend)/components/ui/popover'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/(frontend)/components/ui/command'

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

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [selectedAddId, setSelectedAddId] = useState('')
  const [selectedRemoveId, setSelectedRemoveId] = useState('')
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([])
  const [currentCompanies, setCurrentCompanies] = useState<any[]>([])
  const [meetingData, setMeetingData] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Popover state
  const [openAdd, setOpenAdd] = useState(false)
  const [openRemove, setOpenRemove] = useState(false)

  // Fetch data
  useEffect(() => {
    if (id) fetchMeetingData()
  }, [id])

  const fetchMeetingData = async () => {
    try {
      const res = await fetch(`/api/meetings/${id}?depth=1`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setMeetingData(data)

      const companiesInMeeting = data.companies || []
      setCurrentCompanies(companiesInMeeting)

      const allRes = await fetch(`/api/companies?where[type][equals]=regular&limit=0&depth=0`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const allData = await allRes.json()

      const inMeetingIds = companiesInMeeting.map((c: any) => (typeof c === 'string' ? c : c.id))
      const available = allData.docs.filter((c: any) => !inMeetingIds.includes(c.id))
      setAvailableCompanies(available)
    } catch (err) {
      console.error('Error fetching meeting data:', err)
    }
  }

  // Add company
  const handleAdd = async () => {
    if (!selectedAddId || !id) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/meetings/add-company', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: id, companyId: selectedAddId }),
      })
      const result = await res.json()
      if (result.success) {
        alert('החברה נוספה בהצלחה')
        setShowAddModal(false)
        setSelectedAddId('')
        window.location.reload()
      } else {
        alert(`שגיאה: ${result.message}`)
      }
    } catch (err) {
      console.error('Error adding company:', err)
      alert('שגיאה בהוספת חברה')
    } finally {
      setIsProcessing(false)
    }
  }

  // Remove company
  const handleRemove = async () => {
    if (!selectedRemoveId || !id) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/meetings/remove-company', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: id, companyId: selectedRemoveId }),
      })
      const result = await res.json()
      if (result.success) {
        alert('החברה הוסרה בהצלחה')
        setShowRemoveModal(false)
        setSelectedRemoveId('')
        window.location.reload()
      } else {
        alert(`שגיאה: ${result.message}`)
      }
    } catch (err) {
      console.error('Error removing company:', err)
      alert('שגיאה בהסרת חברה')
    } finally {
      setIsProcessing(false)
    }
  }

  // Helper: get name for add
  const getAddName = () => {
    const company = availableCompanies.find((c) => c.id === selectedAddId)
    return company?.name || ''
  }

  // Helper: get name for remove
  const getRemoveName = () => {
    const company = currentCompanies.find((c) => {
      const cid = typeof c === 'string' ? c : c.id
      return cid === selectedRemoveId
    })
    return typeof company === 'string' ? company : company?.name || selectedRemoveId
  }

  // Grouped vote URL
  const getGroupedVoteUrl = (item: any) => {
    const parent = item.parentCompany || item.name
    const checksum = item.vote?.checksum
    const grouped = votedCompanies.filter((c) => {
      const cp = c.parentCompany || c.name
      return cp === parent && c.vote?.checksum === checksum
    })
    const ids = grouped.map((c) => c.id).join(',')
    return `/admin/grouped-votes/?meetingId=${id}&companyIds=${ids}`
  }

  const notVotedColumns = { company: true, nominalValue: true, percentageHolding: true }
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
      {/* Buttons */}
      <div className="flex gap-2 mb-4">
        <Button onClick={() => setShowAddModal(true)} variant="default" className="gap-2">
          <Plus className="h-4 w-4" /> הוסף חברה
        </Button>
        <Button onClick={() => setShowRemoveModal(true)} variant="destructive" className="gap-2">
          <Trash2 className="h-4 w-4" /> הסר חברה
        </Button>
      </div>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="useTw" dir="rtl">
          <DialogHeader style={{ textAlign: 'right' }}>
            <DialogTitle>הוסף חברה לאסיפה</DialogTitle>
            <DialogDescription>
              בחר חברה להוסיף לאסיפה. החברה תתווסף עם החזקה של 1 יחידה.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Popover open={openAdd} onOpenChange={setOpenAdd} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openAdd}
                  className="w-full justify-between text-left font-normal"
                  style={{ direction: 'rtl' }}
                >
                  {selectedAddId ? getAddName() : 'בחר חברה...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popper-anchor-width)] p-0"
                style={{
                  direction: 'rtl',
                  backgroundColor: 'white',
                  zIndex: 9999
                }}
                align="end"
                sideOffset={5}
              >
                <Command className="bg-white">
                  <CommandInput placeholder="הקלד לחיפוש חברה..." className="h-9" />
                  <CommandList>
                    <CommandGroup
                      className="max-h-60 overflow-auto"
                      style={{
                        minHeight: '1px',
                        backgroundColor: 'white'
                      } as React.CSSProperties}
                    >
                      {availableCompanies.map((company) => (
                        <CommandItem
                          key={company.id}
                          value={company.id}
                          keywords={[company.name]}
                          onSelect={() => {
                            setSelectedAddId(company.id)
                            setOpenAdd(false)
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedAddId === company.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          {company.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedAddId && meetingData && (
            <DialogDescription className="text-sm">
              לחיצה על אישור תוסיף לחברה <strong className="font-bold">{getAddName()}</strong> החזקה
              לתאריך{' '}
              <strong className="font-bold">
                {new Date(meetingData.holdingsLimit).toLocaleDateString('he-IL')}
              </strong>
              .
            </DialogDescription>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="mx-1"
              onClick={() => {
                setShowAddModal(false)
                setSelectedAddId('')
                setOpenAdd(false)
              }}
            >
              ביטול
            </Button>
            <Button className="mx-1" onClick={handleAdd} disabled={!selectedAddId || isProcessing}>
              {isProcessing ? 'מעבד...' : 'אישור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Modal */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="useTw" dir="rtl">
          <DialogHeader style={{ textAlign: 'right' }}>
            <DialogTitle>הסר חברה מהאסיפה</DialogTitle>
            <DialogDescription>
              בחר חברה להסיר מהאסיפה. כל ההצבעות של החברה יימחקו.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Popover open={openRemove} onOpenChange={setOpenRemove} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openRemove}
                  className="w-full justify-between text-left font-normal"
                  style={{ direction: 'rtl' }}
                >
                  {selectedRemoveId ? getRemoveName() : 'בחר חברה...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popper-anchor-width)] p-0"
                style={{
                  direction: 'rtl',
                  backgroundColor: 'white',
                  zIndex: 9999
                }}
                align="end"
                sideOffset={5}
              >
                <Command className="bg-white">
                  <CommandInput placeholder="הקלד לחיפוש חברה..." className="h-9" />
                  <CommandList>
                    <CommandGroup
                      className="max-h-60 overflow-auto"
                      style={{
                        minHeight: '1px',
                        backgroundColor: 'white'
                      } as React.CSSProperties}
                    >
                      {currentCompanies.map((company) => {
                        const cid = typeof company === 'string' ? company : company.id
                        const cname = typeof company === 'string' ? company : company.name
                        return (
                          <CommandItem
                            key={cid}
                            value={cid}
                            keywords={[cname]}
                            onSelect={() => {
                              setSelectedRemoveId(cid)
                              setOpenRemove(false)
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedRemoveId === cid ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {cname}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedRemoveId && (
            <DialogDescription className="text-sm text-red-600 font-semibold">
              שים לב: אתה עומד להסיר את החברה <strong>{getRemoveName()}</strong>. אם יש הצבעות – הן
              יימחקו.
            </DialogDescription>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="mx-1"
              onClick={() => {
                setShowRemoveModal(false)
                setSelectedRemoveId('')
                setOpenRemove(false)
              }}
            >
              ביטול
            </Button>
            <Button
              className="mx-1"
              onClick={handleRemove}
              disabled={!selectedRemoveId || isProcessing}
              variant="destructive"
            >
              {isProcessing ? 'מעבד...' : 'אישור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      ) : null}

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
              {processedVotedData.map((item) => (
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
                      <span className="text-lg">{item.vote?.reported ? 'Yes' : 'No'}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default VotingTablesField
