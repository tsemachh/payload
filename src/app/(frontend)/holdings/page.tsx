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
  const [showConfirmButtons, setShowConfirmButtons] = useState(false)
  const [editForm, setEditForm] = useState(true)

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

    setIsValidating(true)
    setShowConfirmButtons(false)
    setEditForm(false)

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

        if (feedResults.fatalErrors.length == 0) setShowConfirmButtons(true)
      } else {
        setIsSuccess(false)
        toast({
          title: 'שגיאה בהעלאת הקובץ',
          description: result.error || 'אירעה שגיאה בהעלאת הקובץ',
          variant: 'destructive',
        })
      }
    } catch (error) {
      setIsSuccess(false)
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

      // Save the file (validateOnly=false)
      const response = await fetch(
        `/api/holdings/upload-holdings?valueDate=${formattedDate}&companies=${encodeURIComponent(JSON.stringify(selectedCompanies))}&validateOnly=false`,
        {
          method: 'POST',
          body: file,
        },
      )

      const result = await response.json()

      if (response.ok) {
        setIsSuccess(true)
        setShowConfirmButtons(false)
        toast({
          title: 'הצלחה',
          description: 'קובץ האחזקות נשמר בהצלחה',
          variant: 'default',
        })
      } else {
        setIsSuccess(false)
        toast({
          title: 'שגיאה בשמירת הקובץ',
          description: result.error || 'אירעה שגיאה בשמירת הקובץ',
          variant: 'destructive',
        })
      }
    } catch (error) {
      setIsSuccess(false)
      console.error('Error saving file:', error)
      toast({
        title: 'שגיאה בשמירת הקובץ',
        description: 'אירעה שגיאה בשמירת הקובץ',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Cancel the upload
  const handleCancel = () => {
    setShowConfirmButtons(false)
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
            <h2 className="text-xl font-bold text-center">
              אחזקות מקובץ <bdi className="inline-block ltr-dir">{file.name}</bdi> לתאריך{' '}
              {format(date, 'dd/MM/yyyy')}
            </h2>
          )}
          <ProcessingResults
            isSuccess={isSuccess}
            validRecords={validRecords}
            recordErrors={recordErrors}
            warnings={warnings}
            fatals={fatals}
            className="mt-16"
            showConfirmButtons={showConfirmButtons}
            onConfirm={handleSaveConfirmed}
            onCancel={handleCancel}
            isValidating={isValidating}
            isUploading={isUploading}
          />
        </>
      )}
    </div>
  )
}
