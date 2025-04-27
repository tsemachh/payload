'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/providers/auth-provider'
import { HoldingFeedLine } from '@/payload-types'
import {
  FeedFatalError,
  FeedValidationResult,
  FeedWarning,
} from '@/collections/holdings/feeds/FeedTypes'
import { CompanyTreeSelector, TreeNode } from './components/CompanySelector'
import { transformCompaniesToTree } from '../helpers/utils-holdings'
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
} from '../components/ui/dialog'
import { AlertTriangle } from 'lucide-react'

export default function HoldingsFeedView() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(() => {
    // Load selected companies from localStorage on component mount
    if (typeof window !== 'undefined') {
      const savedCompanies = localStorage.getItem('selectedHoldingsCompanies')
      return savedCompanies ? JSON.parse(savedCompanies) : []
    }
    return []
  })
  const [date, setDate] = useState<Date | undefined>()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [fatals, setFatals] = useState<FeedFatalError[]>([])
  const [recordErrors, setRecordErrors] = useState<HoldingFeedLine[]>([])
  const [validRecords, setvalidRecords] = useState<HoldingFeedLine[]>([])
  const [warnings, setWarnings] = useState<FeedWarning[]>([])
  const [editForm, setEditForm] = useState(true)
  const [saveError, setSaveError] = useState(false)
  const router = useRouter()

  // Extract companies from user
  useEffect(() => {
    if (user?.companies) {
      // Transform the flat company structure into a hierarchical tree
      const transformedCompanies = transformCompaniesToTree(user.companies)
      setCompanies(transformedCompanies)
      setIsLoading(false)
    }
    if (user?.leafCompanies) {
      const tmpSelectedCompanies = user?.leafCompanies.map((company) =>
        typeof company === 'string' ? company : company.id,
      )
      setSelectedCompanies(tmpSelectedCompanies)
    }
  }, [user])

  // Save selected companies to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedHoldingsCompanies', JSON.stringify(selectedCompanies))
    }
  }, [selectedCompanies])

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

  // Second step: save the validated file
  const handleSaveConfirmed = async () => {
    if (!date || !file) {
      return
    }
    setIsUploading(true)
    try {
      const formattedDate = format(date, 'yyyy-MM-dd')
      const formattedCompanies = encodeURIComponent(JSON.stringify(selectedCompanies))
      // Save the file (validateOnly=false)
      const response = await fetch(
        `/api/holdings/upload-holdings?valueDate=${formattedDate}&companies=${formattedCompanies}&validateOnly=false`,
        {
          method: 'POST',
          body: file,
        },
      )
      if (response.ok) {
        const payload = {
          date: date.toISOString(),
          selectedCompanies,
        }
        const encoded = btoa(JSON.stringify(payload))
        router.push(`/holdings/view?data=${encodeURIComponent(encoded)}`)
      } else {
        setSaveError(true)
      }
    } catch (error) {
      setSaveError(true)
    } finally {
      setIsUploading(false)
    }
  }

  // Cancel the upload
  const handleCancel = () => {
    setEditForm(true)
    setRecordErrors([])
    setWarnings([])
    setFile(null)
  }

  return (
    <div className="space-y-6">
      {editForm ? (
        <>
          <div className="flex flex-col gap-6 px-4 pt-10 md:flex-row md:justify-center md:gap-6 md:px-10">
            <div>
              <label className="text-base font-semibold mb-2 block">חברות</label>
              <CompanyTreeSelector
                companies={companies}
                selectedCompanies={selectedCompanies}
                onSelectionChange={setSelectedCompanies}
                className="w-full"
                isLoading={isLoading}
              />
            </div>

            <div className="">
              <label className="text-base font-semibold mb-2 block">תאריך ערך</label>
              <DateSelector
                date={date}
                onDateChange={setDate}
                className="w-full"
                filterDate={(date) => {
                  const day = date.getDay()
                  return day == 5 || day == 6
                }}
              />
            </div>

            <div className="">
              <label className="text-base font-semibold mb-2 block">קובץ אחזקות</label>
              <FileUploader onFileChange={setFile} disabled={isUploading} className="w-full" />
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <Button
              onClick={
                !date || !file || isUploading || selectedCompanies.length === 0
                  ? () => {}
                  : handleSubmit
              }
              className="px-40"
              style={
                !date || !file || isUploading || selectedCompanies.length === 0
                  ? { cursor: 'not-allowed', opacity: 0.5 }
                  : {}
              }
            >
              {isUploading ? 'מעלה...' : 'הזן אחזקות'}
            </Button>
          </div>
        </>
      ) : (
        <>
          {date && file && (
            <h2 className="text-xl text-center">
              אחזקות מקובץ{' '}
              <bdi className="inline-block font-mono" dir={'ltr'}>
                {file.name}
              </bdi>{' '}
              לתאריך {format(date, 'dd/MM/yyyy')}
            </h2>
          )}
          <ProcessingResults
            isSuccess={isSuccess}
            setIsSuccess={setIsSuccess}
            validRecords={validRecords}
            recordErrors={recordErrors}
            warnings={warnings}
            fatals={fatals}
            className="mt-16"
            onConfirm={handleSaveConfirmed}
            onCancel={handleCancel}
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
    </div>
  )
}
