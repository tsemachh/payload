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
 <div className="pr-4 text-right">
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0">
        <div className="md:w-2/12 md:pl-2">
            <label className="text-sm font-medium mb-2 block">חברות</label>
            <CompanyTreeSelector
                companies={companies}
                selectedCompanies={selectedCompanies}
                onSelectionChange={setSelectedCompanies}
                className="h-10 text-right"
            />
          </div>

          <div className="md:w-2/12 md:pl-2">
          <label className="text-sm font-medium mb-2 block">תאריך ערך</label>
            <DateSelector date={date} onDateChange={setDate} className="h-10 text-right" />
          </div>

         <div className="md:w-4/12 md:pl-2">
          <label className="text-sm font-medium mb-2 block">קובץ אחזקות</label>
            <FileUploader
                onFileChange={setFile}
                disabled={isUploading}
                className="h-10 text-right"
            />
          </div>

        <div className=" md:w-auto flex items-end">
            <Button
                onClick={handleSubmit}
                disabled={!date || !file || isUploading || selectedCompanies.length === 0}
            className="h-10 w-full md:w-auto px-8"
            >
              {isUploading ? 'מעלה...' : 'הזן'}
            </Button>
        </div>
      </div>
        <ProcessingResults
            isSuccess={isSuccess}
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
