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
import { fetchWithErrorHandling, postWithErrorHandling } from '../helpers/fetch-helpers'
import { handleAndNotifyError } from '../helpers/error-handler'

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
  const [validRecords, setValidRecords] = useState<HoldingFeedLine[]>([])
  const [warnings, setWarnings] = useState<FeedWarning[]>([])
  const [editForm, setEditForm] = useState(true)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    if (user) {
      const companiesWithWritePermission = getCompaniesWithPermission(user, 'write')
      const hasWritePermissions = companiesWithWritePermission.length > 0
      setIsReadOnly(!hasWritePermissions)
    }
  }, [user])

  const navGuard = useNavigationGuard({
    enabled: (params) => {
      if (params.to.includes('/holdings/view?date')) {
        return false
      }
      return !editForm
    },
  })

  const handleSelectionChangeAction = async (selected: string[]) => {
    setSelectedCompanies(selected)
  }

  const handleDateChangeAction = async (newDate: Date | undefined) => {
    setDate(newDate)
  }

  const handleFileChangeAction = async (file: File | null) => {
    setFile(file)
  }

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
    setValidRecords([])
    setSilencedRecords([])
    setRecordErrors([])
    setFatals([])
    setWarnings([])

    try {
      const formattedDate = format(date, 'yyyy-MM-dd')
      const response = await fetchWithErrorHandling(
        `/api/holdings/upload-holdings?valueDate=${formattedDate}&companies=${encodeURIComponent(JSON.stringify(selectedCompanies))}&validateOnly=true`,
        {
          method: 'POST',
          body: file,
          errorMessage: 'שגיאה בהעלאת הקובץ',
          notifyOnError: true,
        },
      )

      const feedResults: FeedValidationResult = (response as any).feedResult
      setValidRecords(feedResults.validRecords)
      setFatals(feedResults.fatalErrors)
      setWarnings(feedResults.warnings)
      setRecordErrors(feedResults.recordErrors)
      setSilencedRecords(feedResults.silencedRecords)
    } catch (error) {
      handleAndNotifyError(error, 'שגיאה בהעלאת הקובץ')
      setEditForm(true)
    } finally {
      setIsValidating(false)
    }
  }

  const handleRefreshAction = async (records: HoldingFeedLine[]) => {
    setValidRecords([])
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
      const response = await postWithErrorHandling(
        `/api/holdings/refresh?companies=${selectedCompanies}`,
        standardizedRecords,
        {
          errorMessage: 'שגיאה בעדכון טבלאות',
          notifyOnError: true,
        },
      )

      const validationResult: FeedValidationResult = (response as any).validationResult
      setValidRecords(validationResult.validRecords)
      setFatals(validationResult.fatalErrors)
      setWarnings(validationResult.warnings)
      setRecordErrors(validationResult.recordErrors)
      setSilencedRecords(validationResult.silencedRecords)
    } catch (error) {
      handleAndNotifyError(error, 'שגיאה בעדכון טבלאות')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSaveConfirmedAction = async () => {
    if (!date || !file) {
      handleAndNotifyError(new Error('תאריך או קובץ חסרים'), 'שגיאה בשמירת הקובץ')
      return
    }

    setIsUploading(true)
    try {
      const formattedDate = date.toISOString()
      const cleanedCompanies = selectedCompanies.filter(Boolean)
      const formattedCompanies = encodeURIComponent(JSON.stringify(cleanedCompanies))

      const response = await fetchWithErrorHandling(
        `/api/holdings/upload-holdings?valueDate=${formattedDate}&companies=${formattedCompanies}&validateOnly=false`,
        {
          method: 'POST',
          body: file,
          errorMessage: 'שגיאה בשמירת הקובץ',
          notifyOnError: true,
        },
      )

      router.push(`/holdings/view?date=${format(date, 'yyyy-MM-dd')}`)
    } catch (error) {
      setSaveError(true)
      setEditForm(true)
      handleAndNotifyError(error, 'שגיאה בשמירת הקובץ')
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
      <div className="flex flex-col h-[500px] items-center pt-[100px]">
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
                showFunds={true}
                showBorder={true}
                checkActive={true}
              />
            </div>

            <div>
              <label className="text-base font-semibold mb-2 block">תאריך ערך</label>
              <DateSelector
                date={date}
                onDateChangeAction={handleDateChangeAction}
                className="w-full"
                filterDate={(date) => {
                  const now = new Date()
                  now.setHours(0, 0, 0, 0)
                  const day = date.getDay()
                  return day === 5 || day === 6 || date > now
                }}
              />
            </div>

            <div>
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
              החזקות מקובץ
              <bdi className="inline-block font-mono" dir={'ltr'}>
                {file.name}
              </bdi>
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
            onRefreshAction={handleRefreshAction}
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
