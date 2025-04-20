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
  const [isValidating, setIsValidating] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errors, setErrors] = useState<ProcessingError[]>([])
  const [warnings, setWarnings] = useState<ProcessingWarning[]>([])
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [validatedFeed, setValidatedFeed] = useState<HoldingsFeed | null>(null)
  const [warningInfo, setWarningInfo] = useState<{
    existingHoldings: boolean
    existingHoldingsCount: number
  }>({
    existingHoldings: false,
    existingHoldingsCount: 0,
  })
  const [feedId, setFeedId] = useState<string>('')
  const [showConfirmButtons, setShowConfirmButtons] = useState(false)

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

  // First step: validate the file without saving
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

    setIsValidating(true)
    setErrors([])
    setWarnings([])
    setShowConfirmButtons(false)
    setValidatedFeed(null)

    try {
      const formattedDate = format(date, 'yyyy-MM-dd')

      // Validate file without saving (validateOnly=true)
      const response = await fetch(
        `/api/holdings/upload-holdings-csv?valueDate=${formattedDate}&companies=${encodeURIComponent(JSON.stringify(selectedCompanies))}&validateOnly=true`,
        {
          method: 'POST',
          body: file,
        },
      )

      const result = await response.json()

      if (response.ok) {
        const feed: HoldingsFeed = result.holdingsFeed
        const feedResult = result.feedResult
        setValidatedFeed(feed)
        setFeedId(feed.id)

        // Process and display record errors from feedResult
        if (feedResult.recordErrors && feedResult.recordErrors.length > 0) {
          // TODO: Replace 'any' with proper type once feedResult typing is finalized
          // @ts-ignore
          const processedErrors: ProcessingError[] = feedResult.recordErrors.map(error => ({
            lineNumber: error.lineNumber || undefined,
            stockId: error.stockId || undefined,
            accountId: error.accountId || undefined,
            quantity: error.quantity?.toString() || undefined,
            error: error.error || ''
          }));
          setErrors(processedErrors);
        }

        // Check for fatal errors
        const hasFatalErrors = feedResult.fatalErrors && feedResult.fatalErrors.length > 0;

        if (hasFatalErrors) {
          setIsSuccess(false);
          // Don't show confirm buttons for fatal errors
        } else {
          // Show confirm buttons for warnings and record-level errors
          setShowConfirmButtons(true);
          setIsSuccess(true);
        }

        // Process warnings
        const feedWarnings: ProcessingWarning[] = [];

        // Process all warnings from feedResult
        if (feedResult.warnings && feedResult.warnings.length > 0) {
          // TODO: Replace 'any' with a proper RecordError type when available
          // @ts-ignore
          feedResult.warnings.forEach(warning => {
            switch (warning.type) {
              case 'duplicateFeedForDate':
                feedWarnings.push({
                  type: 'existingHoldings',
                  message: warning.message || 'כבר קיימת הזנה לתאריך זה',
                  count: warning.count,
                });
                break;
              case 'unknownAccounts':
                feedWarnings.push({
                  type: 'missingAccounts',
                  message: warning.message || 'חשבונות לא מוכרים',
                  details: warning.details || [],
                  count: warning.count,
                });
                break;
              case 'lineCountDifference':
                feedWarnings.push({
                  type: 'lineCountDifference',
                  message: warning.message || 'פער של מעל 5% בכמות השורות',
                  details: warning.details || [],
                });
                break;
              case 'missingAccounts':
                feedWarnings.push({
                  type: 'missingAccounts',
                  message: warning.message || 'חשבונות חסרים בהשוואה להזנה קודמת',
                  details: warning.details || [],
                  count: warning.count,
                });
                break;
              default:
                feedWarnings.push({
                  type: 'missingAccounts',
                  message: warning.message || 'אזהרה',
                  details: warning.details || [],
                  count: warning.count,
                });
            }
          });
        }

        setWarnings(feedWarnings);
      } else {
        setIsSuccess(false)
        toast({
          title: 'שגיאה בבדיקת הקובץ',
          description: result.error || 'אירעה שגיאה בבדיקת הקובץ',
          variant: 'destructive',
        })
      }
    } catch (error) {
      setIsSuccess(false)
      console.error('Error validating file:', error)
      toast({
        title: 'שגיאה בבדיקת הקובץ',
        description: 'אירעה שגיאה בבדיקת הקובץ',
        variant: 'destructive',
      })
    } finally {
      setIsValidating(false)
    }
  }

  // Second step: save the validated file
  const handleSaveConfirmed = async () => {
    if (!validatedFeed || !date || !file) {
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
    setValidatedFeed(null);
    setErrors([]);
    setWarnings([]);
    setFile(null);
  };

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
 <div className="pr-4 space-y-6 text-right">
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0">
        <div className="md:w-2/12 md:pl-2">
            <label className="text-sm font-medium mb-2 block">חברות</label>
            <CompanySelector
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
            errors={errors}
            warnings={warnings}
            className="mt-8"
            showConfirmButtons={showConfirmButtons}
            onConfirm={handleSaveConfirmed}
            onCancel={handleCancel}
            isValidating={isValidating}
            isUploading={isUploading}
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
