'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/providers/auth-provider'
import { CompanySelector, Company } from './CompanySelector'
import { DateSelector } from './DateSelector'
import { FileUploader } from './FileUploader'
import { ProcessingResults, ProcessingError, ProcessingWarning } from './ProcessingResults'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { AlertCircle } from 'lucide-react'

export function HoldingsFeed() {
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errors, setErrors] = useState<ProcessingError[]>([])
  const [warnings, setWarnings] = useState<ProcessingWarning[]>([])
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [warningInfo, setWarningInfo] = useState<{
    existingHoldings: boolean;
    existingHoldingsCount: number;
  }>({
    existingHoldings: false,
    existingHoldingsCount: 0
  })
  const [feedId, setFeedId] = useState<string>('')

  // Extract companies from user
  useEffect(() => {
    if (user?.companies) {
      const userCompanies = user.companies.map(company => {
        // Handle company as either a string ID or an object with an ID
        const companyObj = typeof company.companyId === 'string' 
          ? { id: company.companyId, name: company.companyId } 
          : { id: company.companyId?.id || '', name: company.companyId?.name || '' }

        return companyObj
      }).filter(company => company.id !== '')

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
      const response = await fetch(`/api/holdings/upload-holdings-csv?valueDate=${formattedDate}&companies=${encodeURIComponent(JSON.stringify(selectedCompanies))}`, {
        method: 'POST',
        body: file,
      })

      const result = await response.json()

      if (response.ok) {
        setFeedId(result.holdingsFeed.id)

        // Check if there are warnings
        if (result.warnings?.existingHoldings) {
          setWarningInfo({
            existingHoldings: result.warnings.existingHoldings,
            existingHoldingsCount: result.warnings.existingHoldingsCount,
          })
          setShowWarningDialog(true)
        } else {
          // If no warnings, poll for processing status
          setIsProcessing(true)
          pollProcessingStatus(result.holdingsFeed.id)
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

  const pollProcessingStatus = async (id: string) => {
    /*    try {

          const response = await fetch(`/api/holdings-feed/${id}`)
          const result = await response.json()


          if (response.ok) {
            if (result.processingStatus === 'pending') {
              // Continue polling
              setTimeout(() => pollProcessingStatus(id), 1000)
            } else if (result.processingStatus === 'completed') {
              setIsSuccess(true)
              setIsProcessing(false)
              toast({
                title: 'הצלחה',
                description: 'קובץ האחזקות נקלט בהצלחה',
              })
            } else {
              // Failed
              setIsSuccess(false)
              setIsProcessing(false)
              if (result.processingErrors && result.processingErrors.length > 0) {
                setErrors(result.processingErrors)
              }
            }
          } else {
            setIsSuccess(false)
            setIsProcessing(false)
            toast({
              title: 'שגיאה בבדיקת סטטוס עיבוד',
              description: result.error || 'אירעה שגיאה בבדיקת סטטוס עיבוד',
              variant: 'destructive',
            })
          }
        } catch (error) {
          setIsSuccess(false)
          setIsProcessing(false)
          console.error('Error polling processing status:', error)
        }
        */
  }

  const handleConfirmWarning = () => {
    setShowWarningDialog(false)

    if (feedId) {
      setIsProcessing(true)

      // Add warning about replacing existing holdings
      setWarnings([
        ...warnings,
        {
          type: 'existingHoldings',
          message: `הקובץ יחליף ${warningInfo.existingHoldingsCount} אחזקות קיימות לתאריך ${date ? format(date, 'dd/MM/yyyy') : ''}`,
        }
      ])

      pollProcessingStatus(feedId)
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
          <DateSelector 
            date={date}
            onDateChange={setDate}
            className="w-full"
          />
        </div>

        <div className="w-full md:flex-1">
          <label className="text-sm font-medium mb-2 block">קובץ אחזקות</label>
          <FileUploader 
            onFileChange={setFile}
            disabled={isUploading || isProcessing}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={!date || !file || isUploading || isProcessing || selectedCompanies.length === 0}
          className="px-8"
        >
          {isUploading ? 'מעלה...' : 'הזן אחזקות'}
        </Button>
      </div>

      <ProcessingResults 
        isSuccess={isSuccess}
        isProcessing={isProcessing}
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
                  נמצאו {warningInfo.existingHoldingsCount} אחזקות קיימות לתאריך {date ? format(date, 'dd/MM/yyyy') : ''}. 
                  העלאת הקובץ החדש תחליף את האחזקות הקיימות.
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
