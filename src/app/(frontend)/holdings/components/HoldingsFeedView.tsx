'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/providers/auth-provider'
import { Company, CompanySelector } from './CompanySelector'
import { DateSelector } from './DateSelector'
import { FileUploader } from './FileUploader'
import { ProcessingError, ProcessingResults, ProcessingWarning } from './ProcessingResults'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertCircle } from 'lucide-react'
import { HoldingsFeed } from '@/payload-types'

export function HoldingsFeedView() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(() => {
    // Load selected companies from localStorage on component mount
    if (typeof window !== 'undefined') {
      const savedCompanies = localStorage.getItem('selectedHoldingsCompanies')
      return savedCompanies ? JSON.parse(savedCompanies) : []
    }
    return []
  })
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errors, setErrors] = useState<ProcessingError[]>([])
  const [warnings, setWarnings] = useState<ProcessingWarning[]>([])
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [warningInfo, setWarningInfo] = useState<{
    existingHoldings: boolean
    existingHoldingsCount: number
  }>({
    existingHoldings: false,
    existingHoldingsCount: 0,
  })
  const [feedId, setFeedId] = useState<string>('')

  // Extract companies from user
  useEffect(() => {
    if (user?.companies) {
      const userCompanies = user.companies
        .map((company) => {
          // Handle company as either a string ID or an object with an ID
          return typeof company.companyId === 'string'
            ? { id: company.companyId, name: company.companyId }
            : { id: company.companyId?.id || '', name: company.companyId?.name || '' }
        })
        .filter((company) => company.id !== '')

      setCompanies(userCompanies)
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

    if (!file) {
      toast({
        title: 'שגיאה',
        description: 'נא להעלות קובץ',
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

    setIsUploading(true)
    setErrors([])
    setWarnings([])

    try {
      const formattedDate = format(date, 'yyyy-MM-dd')

      // Upload file with company selection
      const response = await fetch(
        `/api/holdings/upload-holdings-csv?valueDate=${formattedDate}&companies=${encodeURIComponent(JSON.stringify(selectedCompanies))}`,
        {
          method: 'POST',
          body: file,
        },
      )

      const result = await response.json()

      if (response.ok) {
        setIsSuccess(true)
        const feed:HoldingsFeed= result.holdingsFeed

        // Process and display any processing errors from the feed
        if (feed.processingErrors && feed.processingErrors.length > 0) {
          const processedErrors: ProcessingError[] = feed.processingErrors
            .filter(error => error.line)
            .map(error => ({
              lineNumber: error.line?.lineNumber || undefined,
              stockId: error.line?.stockId || undefined,
              accountId: error.line?.accountId || undefined,
              quantity: error.line?.quantity?.toString() || undefined,
              error: error.line?.error || 'Unknown error'
            }));
          setErrors(processedErrors);
        }
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

  const handleConfirmWarning = () => {
    setShowWarningDialog(false)

    if (feedId) {
      // Add warning about replacing existing holdings
      setWarnings([
        ...warnings,
        {
          type: 'existingHoldings',
          message: `הקובץ יחליף ${warningInfo.existingHoldingsCount} אחזקות קיימות לתאריך ${date ? format(date, 'dd/MM/yyyy') : ''}`,
        },
      ])
    }
  }

  const handleCancelWarning = () => {
    setShowWarningDialog(false)
    setFile(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-6 md:flex-row md:space-y-0 md:space-x-6 md:space-x-reverse">
        <div className="w-full md:w-3/10">
          <label className="text-sm font-medium mb-2 block">חברות</label>
          <CompanySelector
            companies={companies}
            selectedCompanies={selectedCompanies}
            onSelectionChange={setSelectedCompanies}
            className="w-full"
          />
        </div>

        <div className="w-full md:w-1/10">
          <label className="text-sm font-medium mb-2 block">תאריך ערך</label>
          <DateSelector date={date} onDateChange={setDate} className="w-full" />
        </div>

        <div className="w-full md:flex-1">
          <label className="text-sm font-medium mb-2 block">קובץ אחזקות</label>
          <FileUploader
            onFileChange={setFile}
            disabled={isUploading}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!date || !file || isUploading || selectedCompanies.length === 0}
          className="px-8"
        >
          {isUploading ? 'מעלה...' : 'הזן אחזקות'}
        </Button>
      </div>

      <ProcessingResults
        isSuccess={isSuccess}
        errors={errors}
        warnings={warnings}
        className="mt-8"
      />

      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-yellow-500" />
              התראה
            </AlertDialogTitle>
            <AlertDialogDescription>
              {warningInfo.existingHoldings && (
                <p className="mb-2">
                  נמצאו {warningInfo.existingHoldingsCount} אחזקות קיימות לתאריך{' '}
                  {date ? format(date, 'dd/MM/yyyy') : ''}. העלאת הקובץ החדש תחליף את האחזקות
                  הקיימות.
                </p>
              )}
              <p>האם להמשיך?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelWarning}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmWarning}>המשך</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
