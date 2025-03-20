'use client'

import { useState, useRef } from 'react'
import { FileUpload } from '@/components/file-upload'
import { ExportButton } from '../components/export-button'
import { DataTable } from '../components/data-table-client'
import { columns } from './columns'
import { Holding } from './types'
import { Button } from '../components/ui/button'
import { format } from 'date-fns'
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { CalendarIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table'
import { toast } from '../components/ui/use-toast'

export default function Holdings() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [isUploading, setIsUploading] = useState(false)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [warningInfo, setWarningInfo] = useState<{
    existingHoldings: boolean;
    existingHoldingsCount: number;
    processingErrors?: any[];
    missingAccounts?: string[];
    lineCountDifference?: number;
  }>({
    existingHoldings: false,
    existingHoldingsCount: 0
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
  }

  const fetchHoldings = async () => {
    if (!date) return
    
    try {
      const formattedDate = format(date, 'yyyy-MM-dd')
      const response = await fetch(`/api/holdings?date=${formattedDate}`)
      const data = await response.json()
      
      if (response.ok) {
        setHoldings(data.docs.map((holding: any) => ({
          id: holding.id,
          company: holding.stock?.longName || 'N/A',
          stockNumber: holding.stock?.stockId || 'N/A',
          quantity: holding.quantity,
          lastUpdated: holding.updatedAt,
        })))
      } else {
        toast({
          title: 'שגיאה בטעינת נתונים',
          description: data.error || 'אירעה שגיאה בטעינת הנתונים',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching holdings:', error)
      toast({
        title: 'שגיאה בטעינת נתונים',
        description: 'אירעה שגיאה בטעינת הנתונים',
        variant: 'destructive',
      })
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!date) {
      toast({
        title: 'נא לבחור תאריך',
        description: 'חובה לבחור תאריך לפני העלאת קובץ',
        variant: 'destructive',
      })
      return
    }
    
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const formattedDate = format(date, 'yyyy-MM-dd')
      const response = await fetch(`/api/holdings/upload-holdings-csv?valueDate=${formattedDate}`, {
        method: 'POST',
        body: file,
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setUploadResult(result)
        
        // Check if there are warnings
        if (result.warnings?.existingHoldings) {
          setWarningInfo({
            existingHoldings: result.warnings.existingHoldings,
            existingHoldingsCount: result.warnings.existingHoldingsCount,
          })
          setShowWarningDialog(true)
        } else {
          // If no warnings, poll for processing status
          pollProcessingStatus(result.holdingsFeed.id)
        }
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

  const pollProcessingStatus = async (feedId: string) => {
    try {
      const response = await fetch(`/api/holdings-feed/${feedId}`)
      const result = await response.json()
      
      if (response.ok) {
        if (result.processingStatus === 'pending') {
          // Continue polling
          setTimeout(() => pollProcessingStatus(feedId), 1000)
        } else if (result.processingStatus === 'completed') {
          toast({
            title: 'הקובץ עובד בהצלחה',
            description: 'הנתונים נטענו למערכת',
          })
          fetchHoldings()
        } else {
          // Failed
          setWarningInfo({
            ...warningInfo,
            processingErrors: result.processingErrors || [{ error: 'Unknown error occurred' }],
          })
          setShowWarningDialog(true)
        }
      } else {
        toast({
          title: 'שגיאה בבדיקת סטטוס עיבוד',
          description: result.error || 'אירעה שגיאה בבדיקת סטטוס עיבוד',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error polling processing status:', error)
    }
  }

  const handleConfirmUpload = () => {
    setShowWarningDialog(false)
    
    if (uploadResult && uploadResult.holdingsFeed) {
      pollProcessingStatus(uploadResult.holdingsFeed.id)
    }
  }

  const handleCancelUpload = () => {
    setShowWarningDialog(false)
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">החזקות</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <p className="text-sm font-medium">תאריך ערך:</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd/MM/yyyy') : <span>בחר תאריך</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <Button 
            variant="outline" 
            onClick={fetchHoldings}
            disabled={!date}
          >
            טען נתונים
          </Button>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="w-1/2 rtl:ml-4 ltr:mr-4">
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
            disabled={isUploading || !date}
            accept=".csv,.xlsx,.xls"
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          <p className="mt-1 text-xs text-gray-500">העלה קובץ CSV או Excel עם עמודות: מספר נייר ערך, כמות, חשבון</p>
        </div>
        
        <ExportButton 
          data={holdings} 
          filename={`holdings-${date ? format(date, 'yyyy-MM-dd') : 'export'}`} 
        />
      </div>

      {holdings.length > 0 ? (
        <DataTable 
          columns={columns} 
          data={holdings} 
          idField="id"
          defaultSortField="lastUpdated"
          defaultSortDirection="desc"
          tableId="holdings-table"
          pastDateFilterOptions={[
            { value: 'allPast', label: 'כל האחזקות הקודמות' },
          ]}
          futureDateFilterOptions={[
            { value: 'allFuture', label: 'כל האחזקות העתידיות' },
          ]}
        />
      ) : (
        <div className="text-center py-10 text-gray-500">
          לא נמצאו נתונים עבור התאריך הנבחר
        </div>
      )}
      
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
                  נמצאו {warningInfo.existingHoldingsCount} אחזקות קיימות לתאריך זה. 
                  העלאת הקובץ החדש תחליף את האחזקות הקיימות.
                </p>
              )}
              
              {warningInfo.processingErrors && warningInfo.processingErrors.length > 0 && (
                <div className="mb-2">
                  <p className="font-medium text-red-600 mb-1">שגיאות בעיבוד הקובץ:</p>
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>שורה</TableHead>
                          <TableHead>נייר ערך</TableHead>
                          <TableHead>חשבון</TableHead>
                          <TableHead>כמות</TableHead>
                          <TableHead>שגיאה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {warningInfo.processingErrors.map((error, index) => (
                          <TableRow key={index}>
                            <TableCell>{error.lineNumber || 'N/A'}</TableCell>
                            <TableCell>{error.stockId || 'N/A'}</TableCell>
                            <TableCell>{error.accountId || 'N/A'}</TableCell>
                            <TableCell>{error.quantity || 'N/A'}</TableCell>
                            <TableCell className="text-red-600">{error.error || 'Unknown error'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              {warningInfo.missingAccounts && warningInfo.missingAccounts.length > 0 && (
                <p className="mb-2">
                  חשבונות חסרים לעומת הטעינה הקודמת: {warningInfo.missingAccounts.join(', ')}
                </p>
              )}
              
              {warningInfo.lineCountDifference && warningInfo.lineCountDifference > 5 && (
                <p className="mb-2">
                  הפרש של יותר מ-5% במספר השורות לעומת הטעינה הקודמת.
                </p>
              )}
              
              <p>האם להמשיך?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUpload}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpload}>המשך</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
