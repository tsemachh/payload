'use client'
import { Plus, Trash2, ChevronsUpDown, Check, ArchiveRestore } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDocumentInfo, toast } from '@payloadcms/ui'
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

export const ManageMeetingCompanies = () => {
  const { id, data } = useDocumentInfo()

  const router = useRouter()

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [selectedAddId, setSelectedAddId] = useState('')
  const [selectedRemoveId, setSelectedRemoveId] = useState('')
  const [selectedRestoreId, setSelectedRestoreId] = useState('')
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([])
  const [currentCompanies, setCurrentCompanies] = useState<any[]>([])
  const [removedCompanies, setRemovedCompanies] = useState<any[]>([])
  const [meetingData, setMeetingData] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Fund selection state
  const [availableFunds, setAvailableFunds] = useState<any[]>([])
  const [selectedFunds, setSelectedFunds] = useState<string[]>([])
  const [showFundSelection, setShowFundSelection] = useState(false)

  // Stock selection state (for foreign stocks)
  const [availableStocks, setAvailableStocks] = useState<any[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string>('')
  const [showStockSelection, setShowStockSelection] = useState(false)
  const [isForeignStock, setIsForeignStock] = useState(false)

  // Popover state
  const [openAdd, setOpenAdd] = useState(false)
  const [openRemove, setOpenRemove] = useState(false)
  const [openRestore, setOpenRestore] = useState(false)

  // Fetch data
  useEffect(() => {
    console.log('Current document id:', id)
    if (id) fetchMeetingData()
  }, [id, data?.companies])

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

      const removedCompaniesList = data.removedCompanies || []
      setRemovedCompanies(removedCompaniesList)

      const allRes = await fetch(`/api/companies?where[type][equals]=regular&limit=0&depth=0`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const allData = await allRes.json()

      const inMeetingIds = companiesInMeeting.map((c: any) => (typeof c === 'string' ? c : c.id))
      const removedIds = removedCompaniesList.map((c: any) => (typeof c === 'string' ? c : c.id))
      const available = allData.docs.filter((c: any) => {
        return !inMeetingIds.includes(c.id) && !removedIds.includes(c.id)
      })
      setAvailableCompanies(available)
    } catch (err) {
      console.error('Error fetching meeting data:', err)
    }
  }

  // Fetch stock details and check if foreign
  const fetchStockDetails = async () => {
    try {
      const stockId =
        typeof meetingData.stock === 'string' ? meetingData.stock : meetingData.stock?.id
      const res = await fetch(`/api/stocks/${stockId}?depth=1`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const stockData = await res.json()

      // Build available stocks list: main stock + related stocks
      const stocks = [
        { id: stockData.id, name: `${stockData.name} (ראשי)`, stockId: stockData.stockId },
      ]

      if (stockData.relations?.docs && stockData.relations.docs.length > 0) {
        stockData.relations.docs.forEach((relatedStock: any) => {
          stocks.push({
            id: relatedStock.id,
            name: `${relatedStock.name} (עוקב) `,
            stockId: relatedStock.stockId,
          })
        })
      }

      setAvailableStocks(stocks)
      setSelectedStockId(stockData.id) // Default to main stock

      return true
    } catch (err) {
      console.error('Error fetching stock details:', err)
      toast.error('שגיאה בטעינת פרטי נייר ערך')
      return false
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

  // Check stock and show selection if needed
  const handleAddClick = async () => {
    const isForeign = await fetchStockDetails()
    if (isForeign) {
      //TODORachelBra update for all socks after dvora change
      setShowStockSelection(true)
    }
    setShowAddModal(true)
  }
  //   const handleAddClick = async () => {
  //   setShowStockSelection(true)
  //   fetchStockDetails()
  // }

  // Handle company selection - show fund selection
  const handleCompanySelect = (companyId: string) => {
    setSelectedAddId(companyId)
    setOpenAdd(false)

    fetchFundsForCompany(companyId)
  }

  // Move from stock selection to company selection
  const handleStockSelected = () => {
    if (!selectedStockId) {
      toast.error('יש לבחור נייר ערך')
      return
    }
    setShowStockSelection(false)
    // Now show company selection
  }

  // Add company with selected funds
  const handleAdd = async () => {
    if (!selectedAddId || !id || selectedFunds.length === 0) {
      toast.error('יש לבחור חברה ולפחות תיק אחד')
      return
    }
    setIsProcessing(true)
    try {
      // Use selected stock if foreign, otherwise use meeting stock
      const stockToUse = isForeignStock && selectedStockId ? selectedStockId : meetingData.stock

      const res = await fetch('/api/meetings/add-company', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: id,
          companyId: selectedAddId,
          stockId: stockToUse,
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
          toast.warning(message)
        } else {
          toast.success(message)
        }
        setShowAddModal(false)
        setSelectedAddId('')
        setSelectedFunds([])
        setShowFundSelection(false)
        setAvailableFunds([])
        setSelectedStockId('')
        setShowStockSelection(false)
        setAvailableStocks([])
        setIsForeignStock(false)
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
        toast.error(errorMessage)
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

  // Restore company
  const handleRestore = async () => {
    if (!selectedRestoreId || !id) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/meetings/restore-company', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: id, companyId: selectedRestoreId }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('החברה הוחזרה בהצלחה')
        setShowRestoreModal(false)
        setSelectedRestoreId('')
        // Refresh the page to update Payload's document state
        const currentPath = window.location.pathname
        router.push(currentPath)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      console.error('Error restoring company:', err)
      toast.error('שגיאה בהחזרת חברה')
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

  // Helper: get name for restore
  const getRestoreName = () => {
    const company = removedCompanies.find((c) => {
      const cid = typeof c === 'string' ? c : c.id
      return cid === selectedRestoreId
    })
    return typeof company === 'string' ? company : company?.name || selectedRestoreId
  }

  // Helper: get selected stock name
  const getSelectedStockName = () => {
    const stock = availableStocks.find((s) => s.id === selectedStockId)
    return stock?.name || ''
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
        <Button
          onClick={(e) => {
            e.preventDefault()
            handleAddClick()
          }}
          variant="default"
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> הוסף חברה
        </Button>
        <Button
          onClick={(e) => {
            e.preventDefault()
            setShowRemoveModal(true)
          }}
          variant="outline"
          className="gap-2 border-red-600 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" /> הסר חברה
        </Button>
        {removedCompanies.length > 0 && (
          <Button
            onClick={(e) => {
              e.preventDefault()
              setShowRestoreModal(true)
            }}
            variant="outline"
            className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
          >
            <ArchiveRestore className="h-4 w-4" /> החזר חברה שהוסרה
          </Button>
        )}
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
            setSelectedStockId('')
            setShowStockSelection(false)
            setAvailableStocks([])
            setIsForeignStock(false)
            setOpenAdd(false)
          }
        }}
      >
        <DialogContent className="useTw max-w-2xl" dir="rtl">
          <DialogHeader style={{ textAlign: 'right' }}>
            <DialogTitle>הוסף חברה לאסיפה</DialogTitle>
            <DialogDescription>
              {showStockSelection && !selectedAddId
                ? 'בחר את נייר הערך שעבורו תתווסף ההחזקה'
                : !selectedAddId
                  ? 'בחירת חברה להוספה'
                  : 'בחר את התיקים שבהם תתווסף החזקה של 1 יחידה.'}
            </DialogDescription>
          </DialogHeader>

          {showStockSelection && !selectedAddId ? (
            <div className="py-4 space-y-4">
              <div className="text-sm text-gray-600 mb-2">
                בחר את נייר הערך שעבורו תתווסף ההחזקה:
              </div>

              <div className="border rounded-md">
                {availableStocks.map((stock) => (
                  <label
                    key={stock.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="radio"
                      name="stock-selection"
                      checked={selectedStockId === stock.id}
                      onChange={() => setSelectedStockId(stock.id)}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="flex-1">{stock.name}</span>
                    <span className="text-sm text-gray-500">{stock.stockId}</span>
                  </label>
                ))}
              </div>

              <Button onClick={handleStockSelected} className="w-full">
                המשך לבחירת חברה
              </Button>
            </div>
          ) : !selectedAddId ? (
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
                  className="useTw w-[var(--radix-popper-anchor-width)] p-0"
                  style={{
                    direction: 'rtl',
                    zIndex: 9999,
                  }}
                  align="end"
                  sideOffset={5}
                >
                  <Command className="useTw opacity-100">
                    <CommandInput placeholder="הקלד לחיפוש חברה..." className="h-9" />
                    <CommandList>
                      <CommandGroup
                        className="useTw max-h-60 overflow-auto"
                        style={
                          {
                            minHeight: '1px',
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
                  {isForeignStock && (
                    <div className="mb-2 text-xs text-gray-500">
                      נייר ערך: <strong>{getSelectedStockName()}</strong>
                    </div>
                  )}
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
                  החזקה עם ערך של 1{isForeignStock && ` עבור נייר ערך ${getSelectedStockName()}`}{' '}
                  עבור{' '}
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
                setSelectedStockId('')
                setShowStockSelection(false)
                setAvailableStocks([])
                setIsForeignStock(false)
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
            <DialogDescription>בחירת חברה להסרה</DialogDescription>
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
                className="useTw w-[var(--radix-popper-anchor-width)] p-0"
                style={{
                  direction: 'rtl',
                  zIndex: 9999,
                }}
                align="end"
                sideOffset={5}
              >
                <Command className="useTw opacity-100">
                  <CommandInput placeholder="הקלד לחיפוש חברה..." className="h-9" />
                  <CommandList>
                    <CommandGroup
                      className="max-h-60 overflow-auto"
                      style={
                        {
                          minHeight: '1px',
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

      {/* Restore Modal */}
      <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
        <DialogContent className="useTw" dir="rtl">
          <DialogHeader style={{ textAlign: 'right' }}>
            <DialogTitle>החזר חברה לאסיפה</DialogTitle>
            <DialogDescription>בחירת חברה להחזרה</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Popover open={openRestore} onOpenChange={setOpenRestore} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openRestore}
                  className="w-full justify-between text-left font-normal"
                  style={{ direction: 'rtl' }}
                >
                  {selectedRestoreId ? getRestoreName() : 'בחר חברה...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="useTw w-[var(--radix-popper-anchor-width)] p-0"
                style={{
                  direction: 'rtl',
                  zIndex: 9999,
                }}
                align="end"
                sideOffset={5}
              >
                <Command className="useTw opacity-100">
                  <CommandInput placeholder="הקלד לחיפוש חברה..." className="h-9" />
                  <CommandList>
                    <CommandGroup
                      className="max-h-60 overflow-auto"
                      style={
                        {
                          minHeight: '1px',
                        } as React.CSSProperties
                      }
                    >
                      {removedCompanies.map((company) => {
                        const cid = typeof company === 'string' ? company : company.id
                        const cname = typeof company === 'string' ? company : company.name
                        return (
                          <CommandItem
                            key={cid}
                            value={cid}
                            keywords={[cname]}
                            onSelect={() => {
                              setSelectedRestoreId(cid)
                              setOpenRestore(false)
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedRestoreId === cid ? 'opacity-100' : 'opacity-0',
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

          {selectedRestoreId && (
            <DialogDescription className="text-sm text-green-600 font-semibold">
              החברה <strong>{getRestoreName()}</strong> תוחזר לאסיפה ותופיע שוב בהתאם להחזקות
              הקיימות.
            </DialogDescription>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="mx-1"
              onClick={() => {
                setShowRestoreModal(false)
                setSelectedRestoreId('')
                setOpenRestore(false)
              }}
            >
              ביטול
            </Button>
            <Button
              className="mx-1"
              onClick={handleRestore}
              disabled={!selectedRestoreId || isProcessing}
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
