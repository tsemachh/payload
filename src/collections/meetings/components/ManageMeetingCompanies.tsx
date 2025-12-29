'use client'
import { Plus, Trash2, ChevronsUpDown, Check, ArchiveRestore, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDocumentInfo, toast } from '@payloadcms/ui'
import { useState, useEffect, useRef } from 'react'
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
import { Company } from '@/payload-types'

export const ManageMeetingCompanies = () => {
  const { id, data: dataChange } = useDocumentInfo()

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
  const [fundHoldingValues, setFundHoldingValues] = useState<Record<string, number>>({})

  // Stock selection state (for foreign stocks)
  const [availableStocks, setAvailableStocks] = useState<any[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string>('')
  const [showStockSelection, setShowStockSelection] = useState(false)

  // Popover state
  const [openAdd, setOpenAdd] = useState(false)
  const [openRemove, setOpenRemove] = useState(false)
  const [openRestore, setOpenRestore] = useState(false)

  // Loading states
  const [isLoadingStocks, setIsLoadingStocks] = useState(false)
  const [isLoadingFunds, setIsLoadingFunds] = useState(false)
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false)

  // Refs to prevent duplicate calls
  const isFetchingMeetingData = useRef(false)
  const isFetchingCompanies = useRef(false)

  // Fetch data
  useEffect(() => {
    if (id) fetchMeetingData()
  }, [dataChange])

  const fetchMeetingData = async () => {
    // Prevent duplicate calls using ref
    if (isFetchingMeetingData.current) {
      return
    }

    isFetchingMeetingData.current = true
    try {
      // Fetch meeting data using the new endpoint
      const res = await fetch(
        `/api/meetings/manage-companies-help?action=getMeetingData&meetingId=${id}`,
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      )
      const data = await res.json()
      setMeetingData(data)

      const companiesInMeeting = data.companies || []
      setCurrentCompanies(companiesInMeeting)

      const removedCompaniesList = data.removedCompanies || []
      setRemovedCompanies(removedCompaniesList)
    } catch (err) {
      console.error('Error fetching meeting data:', err)
    } finally {
      isFetchingMeetingData.current = false
    }
  }

  // Fetch regular companies - called after stock selection
  const fetchRegularCompanies = async () => {
    // Prevent duplicate calls using ref
    if (isFetchingCompanies.current) {
      return
    }

    isFetchingCompanies.current = true
    setIsLoadingCompanies(true)
    try {
      const allRes = await fetch(`/api/meetings/manage-companies-help?action=getRegularCompanies`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const allData = await allRes.json()
      setAvailableCompanies(allData.docs || [])
    } catch (err) {
      console.error('Error fetching companies:', err)
      toast.error('שגיאה בטעינת חברות')
    } finally {
      setIsLoadingCompanies(false)
      isFetchingCompanies.current = false
    }
  }

  // Fetch stock details and check if foreign
  const fetchStockDetails = async () => {
    setIsLoadingStocks(true)
    try {
      const stockId =
        typeof meetingData.stock === 'string' ? meetingData.stock : meetingData.stock?.id

      // Fetch stock details using the new endpoint
      const res = await fetch(
        `/api/meetings/manage-companies-help?action=getStockDetails&stockId=${stockId}`,
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      )
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
    } catch (err) {
      console.error('Error fetching stock details:', err)
      toast.error('שגיאה בטעינת פרטי נייר ערך')
    } finally {
      setIsLoadingStocks(false)
    }
  }

  // Fetch funds for selected company
  const fetchFundsForCompany = async (company: Company) => {
    setIsLoadingFunds(true)
    try {
      // Convert subCompanies array to comma-separated string
      const subCompaniesParam = Array.isArray(company.subCompanies)
        ? company.subCompanies.map((sc: any) => (typeof sc === 'string' ? sc : sc.id)).join(',')
        : company.subCompanies

      // Fetch funds using the new endpoint
      const res = await fetch(
        `/api/meetings/manage-companies-help?action=getFundsForCompany&subCompanies=${subCompaniesParam}`,
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
    } finally {
      setIsLoadingFunds(false)
    }
  }

  // Check stock and show selection if needed
  const handleAddClick = async () => {
    setShowStockSelection(true)
    setShowAddModal(true)

    // Start fetching both stocks and companies in parallel
    fetchStockDetails()
    fetchRegularCompanies()
  }

  // Handle company selection - show fund selection
  const handleCompanySelect = (company: Company) => {
    setSelectedAddId(company.id)
    setOpenAdd(false)

    fetchFundsForCompany(company)
  }

  // Move from stock selection to company selection
  const handleStockSelected = () => {
    if (!selectedStockId) {
      toast.error('יש לבחור נייר ערך')
      return
    }
    setShowStockSelection(false)
  }

  // Add company with selected funds
  const handleAdd = async () => {
    if (!selectedAddId || !id || selectedFunds.length === 0) {
      toast.error('יש לבחור חברה ולפחות תיק אחד')
      return
    }
    if (!selectedStockId) {
      toast.error('יש לבחור נייר עקך')
      return
    }
    setIsProcessing(true)
    try {
      // Use selected stock if foreign, otherwise use meeting stock
      const stockToUse = selectedStockId

      const res = await fetch('/api/meetings/add-company', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: id,
          companyId: selectedAddId,
          stockId: stockToUse,
          holdingLimit: meetingData.holdingsLimit,
          funds: selectedFunds.map((fundId) => ({
            fundId,
            holdingValue: fundHoldingValues[fundId] || 1,
          })),
        }),
      })
      const result = await res.json()
      if (result.success) {
        // Show detailed message
        let message = result.message
        const added = result.addedFunds.length
        const existing = result.existingFunds.length || 0
        if (existing > 0) {
          message += '\n\nפרטים:\n'
          if (added > 0) {
            message += `\n\n${added === 1 ? 'תיק שנוסף' : 'תיקים שנוספו'}: ${result.addedFunds.join(', ')}\n`
          }
          if (existing > 0) {
            message += `\n\n${existing === 1 ? 'תיק שכבר היה קיים' : 'תיקים שכבר היו קיימים'}: ${result.existingFunds.join(', ')}`
          }
          toast.warning(message, { duration: 10000 })
        } else {
          toast.success(message)
        }
        setShowAddModal(false)
        setSelectedAddId('')
        setSelectedFunds([])
        setShowFundSelection(false)
        setAvailableFunds([])
        setFundHoldingValues({})
        setSelectedStockId('')
        setShowStockSelection(false)
        setAvailableStocks([])
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
    setSelectedFunds((prev) => {
      if (prev.includes(fundId)) {
        // Deselecting - remove from selected and clear holding value
        setFundHoldingValues((values) => {
          const newValues = { ...values }
          delete newValues[fundId]
          return newValues
        })
        return prev.filter((id) => id !== fundId)
      } else {
        // Selecting - add to selected and initialize with default value of 1
        setFundHoldingValues((values) => ({
          ...values,
          [fundId]: 1,
        }))
        return [...prev, fundId]
      }
    })
  }

  // Select all funds
  const selectAllFunds = () => {
    const allFundIds = availableFunds.map((p) => p.id)
    setSelectedFunds(allFundIds)
    // Initialize all with default value of 1
    const initialValues: Record<string, number> = {}
    allFundIds.forEach((id) => {
      initialValues[id] = fundHoldingValues[id] || 1
    })
    setFundHoldingValues(initialValues)
  }

  // Deselect all funds
  const deselectAllFunds = () => {
    setSelectedFunds([])
    setFundHoldingValues({})
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
          className="gap-2 border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
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
            className="gap-2 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
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
            setFundHoldingValues({})
            setSelectedStockId('')
            setShowStockSelection(false)
            setAvailableStocks([])
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

              {isLoadingStocks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : (
                <div className="border rounded-md dark:border-gray-700">
                  {availableStocks.map((stock) => (
                    <label
                      key={stock.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b last:border-b-0 dark:border-gray-700"
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
              )}

              <Button onClick={handleStockSelected} className="w-full" disabled={isLoadingStocks}>
                המשך לבחירת חברה
              </Button>
            </div>
          ) : !selectedAddId ? (
            <div className="py-4">
              {isLoadingCompanies ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                  <span className="mr-2 text-gray-500">טוען חברות...</span>
                </div>
              ) : (
                <Popover open={openAdd} onOpenChange={setOpenAdd} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openAdd}
                      className="w-full justify-between text-left font-normal"
                      style={{ direction: 'rtl' }}
                      disabled={isProcessing}
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
                          {Array.isArray(availableCompanies) &&
                            availableCompanies.map((company) => (
                              <CommandItem
                                key={company.id}
                                value={company.id}
                                keywords={[company.name]}
                                onSelect={() => handleCompanySelect(company)}
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
              )}
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium">
                  <div className="mb-2 text-xs text-gray-500">
                    נייר ערך: <strong>{getSelectedStockName()}</strong>
                  </div>
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
                    setFundHoldingValues({})
                  }}
                >
                  שנה חברה
                </Button>
              </div>

              {isLoadingFunds ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : availableFunds.length === 0 ? (
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
                        disabled={selectedFunds.length === availableFunds.length || isProcessing}
                      >
                        בחר הכל
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deselectAllFunds}
                        disabled={selectedFunds.length === 0 || isProcessing}
                      >
                        בטל הכל
                      </Button>
                    </div>
                  )}

                  <div className="border rounded-md max-h-60 overflow-y-auto dark:border-gray-700">
                    {availableFunds.map((fund) => (
                      <div
                        key={fund.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 dark:border-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFunds.includes(fund.id)}
                          onChange={() => toggleFund(fund.id)}
                          className="h-4 w-4 cursor-pointer"
                          disabled={isProcessing}
                        />
                        <span className="flex-1">{fund.name}</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="ערך החזקה"
                          value={fundHoldingValues[fund.id] || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                            setFundHoldingValues((prev) => ({
                              ...prev,
                              [fund.id]: value,
                            }))
                          }}
                          disabled={!selectedFunds.includes(fund.id) || isProcessing}
                          className="w-28 px-2 py-1 text-sm border rounded dark:bg-gray-900 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
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
                  החזקה ב
                  {selectedFunds.length === 1
                    ? 'תיק אחד'
                    : '- ' + selectedFunds.length + ' ' + 'תיקים'}
                  , עבור הנייר <strong className="font-bold">{getSelectedStockName()}</strong>.
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
                setFundHoldingValues({})
                setSelectedStockId('')
                setShowStockSelection(false)
                setAvailableStocks([])
                setOpenAdd(false)
              }}
              disabled={isProcessing}
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
                  disabled={isProcessing}
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
              disabled={isProcessing}
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
                  disabled={isProcessing}
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
              disabled={isProcessing}
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
