'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/providers/auth-provider'
import { getCompaniesWithPermission } from '@/utils/permissions'
import { HoldingFeedLine } from '@/payload-types'
import {
  FeedFatalError,
  FeedValidationResult,
  FeedWarning,
  StandardizedRow,
} from '@/collections/holdings/feeds/FeedTypes'
import { CompanyTreeSelector } from './components/CompanySelector'
import { DateSelector } from './components/DateSelector'
import { FileUploader } from './components/FileUploader'
import { ProcessingResults } from './components/ProcessingResults'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertTriangle } from 'lucide-react'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import { useNavigationGuard } from 'next-navigation-guard'

export default function HoldingsFeedView() {
  const router = useRouter()
  const { user } = useAuth()
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [date, setDate] = useState<Date | undefined>()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [fatals, setFatals] = useState<FeedFatalError[]>([])
  const [recordErrors, setRecordErrors] = useState<HoldingFeedLine[]>([])
  const [silencedRecords, setSilencedRecords] = useState<HoldingFeedLine[]>([])
  const [validRecords, setvalidRecords] = useState<HoldingFeedLine[]>([])
  const [warnings, setWarnings] = useState<FeedWarning[]>([])
  const [editForm, setEditForm] = useState(true)
  const [saveError, setSaveError] = useState(false)
  const [showNavigationWarning, setShowNavigationWarning] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      // Get companies with write permission
      const companiesWithWritePermission = getCompaniesWithPermission(user, 'write')
      // Set read-only mode if user has no write permissions
      const hasWritePermissions = companiesWithWritePermission.length > 0
      setIsReadOnly(!hasWritePermissions)

      if (hasWritePermissions) {
        // If user has write permissions, initialize with those companies
        setSelectedCompanies(companiesWithWritePermission)
      } else if (user.funds) {
        // If no write permissions, initialize with read-only companies
        const readOnlyCompanies = user.funds.map((company) =>
          typeof company === 'string' ? company : company.id,
        )
        setSelectedCompanies(readOnlyCompanies)
      }
    }
  }, [user])

  // Use navigation guard hook for back button and browser navigation
  const navGuard = useNavigationGuard({
    enabled: !editForm,
  })

  // Create an action to update selected companies
  const handleSelectionChangeAction = async (selected: string[]) => {
    setSelectedCompanies(selected)
  }

  // Create an action to update the date
  const handleDateChangeAction = async (newDate: Date | undefined) => {
    setDate(newDate)
  }

  // Create an action to handle file changes
  const handleFileChangeAction = async (file: File | null) => {
    setFile(file)
  }

  // Create actions for ProcessingResults
  const setIsSuccessAction = async (value: boolean) => {
    setIsSuccess(value)
  }

  const handleSubmit = async () => {
    if (!date) {
      toast({
        title: 'שגיאה',
        description: 'נא לבחור תאריך',
        variant: 'destructive',
      })
      return
    }

    if (date && (date.getDay() === 5 || date.getDay() === 6)) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לבחור תאריך שהוא יום שישי או שבת',
        variant: 'destructive',
      })
      return
    }

    if (selectedCompanies.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'נא לבחור לפחות חברה אחת',
        variant: 'destructive',
      })
      return
    }
    setEditForm(false)
    setIsValidating(true)
    setvalidRecords([])
    setSilencedRecords([])
    setRecordErrors([])
    setFatals([])
    setWarnings([])

    try {
      const formattedDate = format(date, 'yyyy-MM-dd')
      // Upload file with company selection
      const response = await fetch(
        `/api/holdings/upload-holdings?valueDate=${formattedDate}&companies=${encodeURIComponent(JSON.stringify(selectedCompanies))}&validateOnly=true`,
        {
          method: 'POST',
          body: file,
        },
      )

      const result = await response.json()
      setIsValidating(false)

      if (response.ok) {
        const feedResults: FeedValidationResult = result.feedResult
        setvalidRecords(feedResults.validRecords)
        setFatals(feedResults.fatalErrors)
        setWarnings(feedResults.warnings)
        setRecordErrors(feedResults.recordErrors)
        setSilencedRecords(feedResults.silencedRecords)
      } else {
        toast({
          title: 'שגיאה בהעלאת הקובץ',
          description: result.error || 'אירעה שגיאה בהעלאת הקובץ',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'שגיאה בהעלאת הקובץ',
        description: 'אירעה שגיאה בהעלאת הקובץ',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }
  const handleRefreshAction = async (records: HoldingFeedLine[]) => {
    setvalidRecords([])
    setSilencedRecords([])
    setRecordErrors([])
    setFatals([])
    setWarnings([])

    const standardizedRecords = records.map((record) => ({
      stockId: record.stockId,
      quantity: record.quantity,
      accountId: record.accountId,
    })) as StandardizedRow[]

    setIsRefreshing(true)
    try {
      const response = await fetch(`/api/holdings/refresh?companies=${selectedCompanies}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(standardizedRecords),
      })

      const result = await response.json()
      if (response.ok) {
        const validationResult: FeedValidationResult = result.validationResult
        setvalidRecords(validationResult.validRecords)
        setFatals(validationResult.fatalErrors)
        setWarnings(validationResult.warnings)
        setRecordErrors(validationResult.recordErrors)
        setSilencedRecords(validationResult.silencedRecords)
      } else {
        toast({
          title: 'עדכון טבלאות נכשל',
          description: result.error || 'עדכון טבלאות נכשל',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'שגיאה בעדכון טבלאות',
        description: 'אירעה שגיאה בעדכון טבלאות',
        variant: 'destructive',
      })
    } finally {
      setIsRefreshing(false)
    }
  }
  const handleSaveConfirmedAction = async () => {
    if (!date || !file) {
      return
    }
    setIsUploading(true)
    try {
      const formattedDate = date.toISOString()
      const cleanedCompanies = selectedCompanies.filter(Boolean)
      const formattedCompanies = encodeURIComponent(JSON.stringify(cleanedCompanies)) // Save the file (validateOnly=false)
      const response = await fetch(
        `/api/holdings/upload-holdings?valueDate=${formattedDate}&companies=${formattedCompanies}&validateOnly=false`,
        {
          method: 'POST',
          body: file,
        },
      )
      if (response.ok) {
        router.push(`/holdings/view?date=${format(date, 'yyyy-MM-dd')}`)
      } else {
        setSaveError(true)
      }
    } catch (error) {
      setSaveError(true)
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancelAction = () => {
    setEditForm(true)
    setRecordErrors([])
    setSilencedRecords([])
    setWarnings([])
    setFile(null)
  }
  if (isRefreshing) {
    return (
      <div className="flex flex-col h-[500px] items-center pt-[100px] ">
        <LoadingSpinnerDiamond />
        <p className="text-center">טוען את הנתונים העדכניים...</p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {editForm ? (
        <>
          <div className="flex flex-col gap-6 px-4 pt-10 md:flex-row md:justify-right md:gap-6 md:px-10">
            {/* Add a read-only notice if needed */}
            {isReadOnly && (
              <div className="w-full bg-yellow-100 p-4 rounded-md text-yellow-800 mb-4">
                אין לך הרשאות להזנת החזקות לחברות אלו. צפייה בלבד.
              </div>
            )}

            <div>
              <label className="text-base font-semibold mb-2 block">חברות</label>
              <CompanyTreeSelector
                selectedCompanies={selectedCompanies}
                onSelectionChangeAction={handleSelectionChangeAction}
                className="w-full"
                allCompaniesIds={user?.funds?.map((company) =>
                  typeof company === 'string' ? company : company.id,
                )}
              />
            </div>

            <div className="">
              <label className="text-base font-semibold mb-2 block">תאריך ערך</label>
              <DateSelector
                date={date}
                onDateChangeAction={handleDateChangeAction}
                className="w-full"
                filterDate={(date) => {
                  const now = new Date()
                  now.setHours(0, 0, 0, 0)
                  const day = date.getDay()
                  return day == 5 || day == 6 || date > now
                }}
              />
            </div>

            <div className="">
              <label className="text-base font-semibold mb-2 block">קובץ החזקות</label>
              <FileUploader
                onFileChangeAction={handleFileChangeAction}
                disabled={isUploading || isReadOnly}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <Button
              variant={
                !date || !file || isUploading || selectedCompanies.length === 0 || isReadOnly
                  ? 'default'
                  : 'defaultHover'
              }
              onClick={
                !date || !file || isUploading || selectedCompanies.length === 0 || isReadOnly
                  ? () => {}
                  : handleSubmit
              }
              className="px-40"
              style={
                !date || !file || isUploading || selectedCompanies.length === 0 || isReadOnly
                  ? { cursor: 'not-allowed', opacity: 0.5 }
                  : {}
              }
            >
              {isReadOnly ? 'צפייה בלבד' : isUploading ? 'מעלה...' : 'הזן החזקות'}
            </Button>
          </div>
        </>
      ) : (
        <>
          {date && file && (
            <h4 className="text-xl text-center">
              החזקות מקובץ{' '}
              <bdi className="inline-block font-mono" dir={'ltr'}>
                {file.name}
              </bdi>{' '}
              לתאריך {format(date, 'dd/MM/yyyy')}
            </h4>
          )}
          <ProcessingResults
            isSuccess={isSuccess}
            setIsSuccessAction={setIsSuccessAction}
            validRecords={validRecords}
            silencedRecords={silencedRecords}
            recordErrors={recordErrors}
            warnings={warnings}
            fatals={fatals}
            companies={selectedCompanies}
            className="mt-16"
            onConfirmAction={handleSaveConfirmedAction}
            onCancelAction={handleCancelAction}
            onRefresh={handleRefreshAction}
            isValidating={isValidating}
            isUploading={isUploading}
          />
          <Dialog open={saveError}>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader className="flex flex-row items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
                <DialogTitle className="text-xl text-red-600 m-0">שגיאה בשמירת הקובץ</DialogTitle>
              </DialogHeader>

              <DialogFooter className="flex justify-end gap-3 mt-6">
                <Button
                  onClick={() => {
                    setSaveError(false)
                    setEditForm(true)
                  }}
                >
                  אישור
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Navigation Warning Dialog */}
      <Dialog open={navGuard.active}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="flex flex-row items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 flex-shrink-0" />
            <DialogTitle className="text-xl text-amber-600 m-0">הזנת החזקות בתהליך</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-center">האם להפסיק את הזנת החזקות לפני שמירתן?</p>
          </div>

          <DialogFooter className="flex justify-center gap-3 mt-6">
            <Button variant="outline" onClick={navGuard.reject}>
              להמשיך בהזנות
            </Button>
            <Button variant="destructive" onClick={navGuard.accept}>
              לצאת ללא שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
