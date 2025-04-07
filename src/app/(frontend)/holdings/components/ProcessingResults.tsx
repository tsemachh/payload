'use client'

import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export interface ProcessingError {
  lineNumber?: number
  stockId?: string
  accountId?: string
  quantity?: string
  error: string
}

export interface ProcessingWarning {
  type: 'existingHoldings' | 'missingAccounts' | 'lineCountDifference'
  message: string
  details?: string[]
  count?: number
}

interface ProcessingResultsProps {
  isSuccess: boolean
  errors: ProcessingError[]
  warnings: ProcessingWarning[]
  className?: string
}

export function ProcessingResults({ 
  isSuccess,
  errors,
  warnings, 
  className 
}: ProcessingResultsProps) {

  if (isSuccess && errors.length === 0 && warnings.length === 0) {
    return (
      <div className={className}>
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700">הצלחה</AlertTitle>
          <AlertDescription className="text-green-600">
            קובץ האחזקות נקלט בהצלחה במערכת.
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  
  return (
    <div className={className}>
      {errors.length > 0 && (
        <div className="mb-6">
          <Alert className="bg-red-50 border-red-200 mb-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertTitle className="text-red-700">שגיאות בקליטת הקובץ</AlertTitle>
            <AlertDescription className="text-red-600">
              נמצאו {errors.length} שגיאות בקובץ האחזקות. אנא תקן את השגיאות ונסה שוב.
            </AlertDescription>
          </Alert>
          
          <div className="max-h-64 overflow-y-auto border rounded-md">
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
                {errors.map((error, index) => (
                  <TableRow key={index}>
                    <TableCell>{error.lineNumber || 'N/A'}</TableCell>
                    <TableCell>{error.stockId || 'N/A'}</TableCell>
                    <TableCell>{error.accountId || 'N/A'}</TableCell>
                    <TableCell>{error.quantity || 'N/A'}</TableCell>
                    <TableCell className="text-red-600">{error.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      {warnings.length > 0 && (
        <div>
          <Alert className="bg-yellow-50 border-yellow-200 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-700">אזהרות</AlertTitle>
            <AlertDescription className="text-yellow-600">
              נמצאו {warnings.length} אזהרות. אנא שים לב לאזהרות הבאות:
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <Alert key={index} className="bg-yellow-50 border-yellow-200">
                <AlertDescription className="text-yellow-700">
                  {warning.message}
                  
                  {warning.details && warning.details.length > 0 && (
                    <ul className="mt-2 list-disc list-inside">
                      {warning.details.map((detail, idx) => (
                        <li key={idx} className="text-yellow-600">{detail}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}