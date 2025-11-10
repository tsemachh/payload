'use client'
import { Plus, Trash2, ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDocumentInfo } from '@payloadcms/ui'
import { useVotingData } from '../hooks/useVotingData'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { toast } from 'sonner'

export const ManageMeetingCompanies = () => {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const { votedCompanies, loading } = useVotingData()

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
        body: JSON.stringify({
          meetingId: id,
          companyId: selectedAddId,
          stockId: meetingData.stock,
        }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('החברה נוספה בהצלחה')
        setShowAddModal(false)
        setSelectedAddId('')
        // Refresh the page to update Payload's document state
        const currentPath = window.location.pathname
        router.push(currentPath)
        router.refresh()
      } else {
        toast.error(`שגיאה: ${result.message}`)
      }
    } catch (err) {
      console.error('Error adding company:', err)
      toast.error('שגיאה בהוספת חברה')
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
        toast.success('החברה הוסרה בהצלחה')
        setShowRemoveModal(false)
        setSelectedRemoveId('')
        // Refresh the page to update Payload's document state
        const currentPath = window.location.pathname
        router.push(currentPath)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      console.error('Error removing company:', err)
      toast.error('שגיאה בהסרת חברה')
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
                  zIndex: 9999,
                }}
                align="end"
                sideOffset={5}
              >
                <Command className="bg-white">
                  <CommandInput placeholder="הקלד לחיפוש חברה..." className="h-9" />
                  <CommandList>
                    <CommandGroup
                      className="max-h-60 overflow-auto"
                      style={
                        {
                          minHeight: '1px',
                          backgroundColor: 'white',
                        } as React.CSSProperties
                      }
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
                  zIndex: 9999,
                }}
                align="end"
                sideOffset={5}
              >
                <Command className="bg-white">
                  <CommandInput placeholder="הקלד לחיפוש חברה..." className="h-9" />
                  <CommandList>
                    <CommandGroup
                      className="max-h-60 overflow-auto"
                      style={
                        {
                          minHeight: '1px',
                          backgroundColor: 'white',
                        } as React.CSSProperties
                      }
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
              שים לב: אתה עומד להסיר את החברה <strong>{getRemoveName()}</strong>
              <br />
              אם לחברה יש הצבעות – הן יימחקו.
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
    </div>
  )
}

export default ManageMeetingCompanies
