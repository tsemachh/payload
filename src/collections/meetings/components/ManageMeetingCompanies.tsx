'use client'
import { Plus, Trash2, ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDocumentInfo } from '@payloadcms/ui'
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

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [selectedAddId, setSelectedAddId] = useState('')
  const [selectedRemoveId, setSelectedRemoveId] = useState('')
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([])
  const [currentCompanies, setCurrentCompanies] = useState<any[]>([])
  const [meetingData, setMeetingData] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Fund selection state
  const [availableFunds, setAvailableFunds] = useState<any[]>([])
  const [selectedFunds, setSelectedFunds] = useState<string[]>([])
  const [showFundSelection, setShowFundSelection] = useState(false)

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

  // Fetch funds for selected company
  const fetchFundsForCompany = async (companyId: string) => {
    try {
      const res = await fetch(
        `/api/companies?where[type][equals]=fund&where[parentCompany][equals]=${companyId}&limit=0&depth=0`,
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      )
      const data = await res.json()
      setAvailableFunds(data.docs || [])
      setShowFundSelection(true)
    } catch (err) {
      console.error('Error fetching funds:', err)
      toast.error('שגיאה בטעינת תיקים')
    }
  }

  // Handle company selection - show fund selection
  const handleCompanySelect = (companyId: string) => {
    setSelectedAddId(companyId)
    setOpenAdd(false)
    fetchFundsForCompany(companyId)
  }

  // Add company with selected funds
  const handleAdd = async () => {
    if (!selectedAddId || !id || selectedFunds.length === 0) {
      toast.error('יש לבחור חברה ולפחות תיק אחד')
      return
    }
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
          holdingLimit: meetingData.holdingsLimit,
          fundsIds: selectedFunds,
        }),
      })
      const result = await res.json()
      if (result.success) {
        // Show detailed message
        let message = result.message
        if (result.existingFunds && result.existingFunds.length > 0) {
          message += `\n\nתיקים שנוספו: ${result.addedFunds.join(', ')}`
          message += `\n\nתיקים שכבר היו קיימים: ${result.existingFunds.join(', ')}`
          toast.warning(message, { duration: 6000 })
        } else {
          toast.success(message)
        }
        setShowAddModal(false)
        setSelectedAddId('')
        setSelectedFunds([])
        setShowFundSelection(false)
        setAvailableFunds([])
        // Refresh the page to update Payload's document state
        const currentPath = window.location.pathname
        router.push(currentPath)
        router.refresh()
      } else {
        // Show error with details
        let errorMessage = result.message
        if (result.existingFunds && result.existingFunds.length > 0) {
          errorMessage += `\n\nתיקים קיימים: ${result.existingFunds.join(', ')}`
        }
        toast.error(errorMessage, { duration: 6000 })
      }
    } catch (err) {
      console.error('Error adding company:', err)
      toast.error('שגיאה בהוספת חברה')
    } finally {
      setIsProcessing(false)
    }
  }

  // Toggle fund selection
  const toggleFund = (fundId: string) => {
    setSelectedFunds((prev) =>
      prev.includes(fundId) ? prev.filter((id) => id !== fundId) : [...prev, fundId],
    )
  }

  // Select all funds
  const selectAllFunds = () => {
    setSelectedFunds(availableFunds.map((p) => p.id))
  }

  // Deselect all funds
  const deselectAllFunds = () => {
    setSelectedFunds([])
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

  if (!id) {
    return (
      <div className="p-4 text-center text-gray-500">
        יש לשמור את האסיפה תחילה כדי לנהל את החברות המזומנות.
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
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open)
          if (!open) {
            setSelectedAddId('')
            setSelectedFunds([])
            setShowFundSelection(false)
            setAvailableFunds([])
            setOpenAdd(false)
          }
        }}
      >
        <DialogContent className="useTw max-w-2xl" dir="rtl">
          <DialogHeader style={{ textAlign: 'right' }}>
            <DialogTitle>הוסף חברה לאסיפה</DialogTitle>
            <DialogDescription>
              {!showFundSelection
                ? 'בחר חברה להוסיף לאסיפה.'
                : 'בחר את התיקים שבהם תתווסף החזקה של 1 יחידה.'}
            </DialogDescription>
          </DialogHeader>

          {!showFundSelection ? (
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
                            onSelect={() => handleCompanySelect(company.id)}
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
          ) : (
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium">
                  חברה נבחרה: <strong>{getAddName()}</strong>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowFundSelection(false)
                    setSelectedAddId('')
                    setSelectedFunds([])
                    setAvailableFunds([])
                  }}
                >
                  שנה חברה
                </Button>
              </div>

              {availableFunds.length === 0 ? (
                <div className="text-center text-red-600 py-4">
                  לא נמצאו תיקים (קרנות) עבור חברה זו
                </div>
              ) : (
                <>
                  {availableFunds.length > 1 && (
                    <div className="flex gap-2 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllFunds}
                        disabled={selectedFunds.length === availableFunds.length}
                      >
                        בחר הכל
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deselectAllFunds}
                        disabled={selectedFunds.length === 0}
                      >
                        בטל הכל
                      </Button>
                    </div>
                  )}

                  <div className="border rounded-md max-h-60 overflow-y-auto">
                    {availableFunds.map((fund) => (
                      <label
                        key={fund.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFunds.includes(fund.id)}
                          onChange={() => toggleFund(fund.id)}
                          className="h-4 w-4 cursor-pointer"
                        />
                        <span className="flex-1">{fund.name}</span>
                      </label>
                    ))}
                  </div>
                  {availableFunds.length > 1 && (
                    <div className="text-sm text-gray-600">
                      נבחרו {selectedFunds.length} מתוך {availableFunds.length} תיקים
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {showFundSelection && meetingData && (
            <div className="min-h-[60px]">
              {selectedFunds.length > 0 ? (
                <DialogDescription className="text-sm">
                  לחיצה על אישור תוסיף לחברה <strong className="font-bold">{getAddName()}</strong>{' '}
                  החזקה עם ערך של 1 עבור{' '}
                  {selectedFunds.length === 1
                    ? 'תיק' + ' ' + selectedFunds.length
                    : selectedFunds.length + ' ' + 'תיקים'}{' '}
                  לתאריך{' '}
                  <strong className="font-bold">
                    {new Date(meetingData.holdingsLimit).toLocaleDateString('he-IL')}
                  </strong>
                  .
                </DialogDescription>
              ) : (
                <DialogDescription className="text-sm text-gray-400">
                  יש לבחור לפחות תיק אחד כדי להמשיך
                </DialogDescription>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="mx-1"
              onClick={() => {
                setShowAddModal(false)
                setSelectedAddId('')
                setSelectedFunds([])
                setShowFundSelection(false)
                setAvailableFunds([])
                setOpenAdd(false)
              }}
            >
              ביטול
            </Button>
            <Button
              className="mx-1"
              onClick={handleAdd}
              disabled={!showFundSelection || selectedFunds.length === 0 || isProcessing}
            >
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
