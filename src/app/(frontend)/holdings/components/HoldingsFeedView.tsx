'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/providers/auth-provider'
import { TreeNode, CompanyTreeSelector } from './CompanySelector'
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
import { HoldingFeedLine, HoldingsFeed } from '@/payload-types'
import { transformCompaniesToTree } from '../../helpers/utils-holdings'
import { FeedFatalError, FeedValidationResult, FeedWarning } from '@/collections/holdings/feeds/processHoldingsFeedCsv'

export function HoldingsFeedView() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<TreeNode[]>([])
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
  const [isValidating, setIsValidating] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [fatals, setFatals] = useState<FeedFatalError[]>([])
  const [recordErrors, setRecordErrors] = useState<HoldingFeedLine[]>([])
  const [validRecords, setvalidRecords] = useState<HoldingFeedLine[]>([])
  const [warnings, setWarnings] = useState<FeedWarning[]>([])
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [showConfirmButtons, setShowConfirmButtons] = useState(false)

  // Extract companies from user
  useEffect(() => {
    if (user?.companies) {
      // Transform the flat company structure into a hierarchical tree
      const transformedCompanies = transformCompaniesToTree(user.companies)
      setCompanies(transformedCompanies)
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

    setvalidRecords([])
    setRecordErrors([])
    setFatals([])
    setWarnings([])

    try {
      const formattedDate = format(date, 'yyyy-MM-dd')

      // Upload file with company selection
      const response = await fetch(
        `/api/holdings/upload-holdings-csv?valueDate=${formattedDate}&companies=${encodeURIComponent(JSON.stringify(selectedCompanies))}&validateOnly=true`,
        {
          method: 'POST',
          body: file,
        },
      )

      const result = await response.json()
      setIsValidating(false)

      if (response.ok) {
        const feedResults:FeedValidationResult= result.feedResult
        setvalidRecords(feedResults.validRecords)
        setFatals(feedResults.fatalErrors)
        setWarnings(feedResults.warnings)
        setRecordErrors((feedResults.recordErrors))

        if (feedResults.fatalErrors.length == 0)
          setShowConfirmButtons(true)
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
      return;
    }

    setIsUploading(true);

    try {
      const formattedDate = format(date, 'yyyy-MM-dd');

      // Save the file (validateOnly=false)
      const response = await fetch(
        `/api/holdings/upload-holdings-csv?valueDate=${formattedDate}&companies=${encodeURIComponent(JSON.stringify(selectedCompanies))}&validateOnly=false`,
        {
          method: 'POST',
          body: file,
        },
      );

      const result = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setShowConfirmButtons(false);
        toast({
          title: 'הצלחה',
          description: 'קובץ האחזקות נשמר בהצלחה',
          variant: 'default',
        });
      } else {
        setIsSuccess(false);
        toast({
          title: 'שגיאה בשמירת הקובץ',
          description: result.error || 'אירעה שגיאה בשמירת הקובץ',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setIsSuccess(false);
      console.error('Error saving file:', error);
      toast({
        title: 'שגיאה בשמירת הקובץ',
        description: 'אירעה שגיאה בשמירת הקובץ',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Cancel the upload
  const handleCancel = () => {
    setShowConfirmButtons(false);
    setRecordErrors([]);
    setWarnings([]);
    setFile(null);
  };

  const handleConfirmWarning = () => {
    setShowWarningDialog(false)
  }

  const handleCancelWarning = () => {
    setShowWarningDialog(false)
    setFile(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 px-4 pt-10 md:flex-row md:justify-center md:gap-6 md:px-10">
        <div>
          <label className="text-base font-semibold mb-2 block">חברות</label>
          <CompanyTreeSelector
            companies={companies}
            selectedCompanies={selectedCompanies}
            onSelectionChange={setSelectedCompanies}
            className="w-full"
          />
        </div>

        <div className="">
          <label className="text-base font-semibold mb-2 block">תאריך ערך</label>
          <DateSelector date={date} onDateChange={setDate} className="w-full" />
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
      </div>
  )
  }
