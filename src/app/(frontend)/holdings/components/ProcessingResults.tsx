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
            <div className="mb-6" dir="rtl">
              <Alert className="bg-red-50 border-red-200 mb-4 max-w-3xl mx-auto">
                <XCircle className="h-4 w-4 text-red-500" />
                <AlertTitle className="text-red-700">שגיאות בקליטת הקובץ</AlertTitle>
                <AlertDescription className="text-red-600">
                  נמצאו {errors.length} שגיאות בקובץ האחזקות. אנא תקן את השגיאות.
                </AlertDescription>
              </Alert>
              <div className="max-w-6xl mx-auto bg-white p-2 rounded-lg border border-red-200 shadow-sm" dir="rtl">
                <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-md">
                  <Table className="w-full text-right border-collapse bg-white">
                    <TableHeader className="bg-red-100 sticky top-0 z-10 text-right">
                      <TableRow>
                        <TableHead className="text-right text-red-700 border px-3 py-2">שורה</TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">נייר ערך</TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">חשבון</TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">כמות</TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">שגיאה</TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">פעולה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errors.map((error, index) => (
                          <TableRow key={index}>
                            <TableCell className="border px-3 py-2">{error.lineNumber || 'N/A'}</TableCell>
                            <TableCell className="border px-3 py-2">{error.stockId || 'N/A'}</TableCell>
                            <TableCell className="border px-3 py-2">{error.accountId || 'N/A'}</TableCell>
                            <TableCell className="border px-3 py-2">{error.quantity || 'N/A'}</TableCell>
                            <TableCell className="border px-3 py-2 text-red-600">{error.error}</TableCell>
                            <TableCell className="border px-3 py-2 text-center">
                              {error ? (
                                  <div className="flex justify-center items-center gap-2">
                                    <button className="text-sm px-3 py-1 rounded-md bg-green-100 hover:bg-green-200 border border-green-300">
                                      המשך
                                    </button>
                                    <button className="text-sm px-3 py-1 rounded-md bg-red-100 hover:bg-red-200 border border-red-300">
                                      בטל
                                    </button>
                                  </div>
                              ) : (
                                  '-'
                              )}
                            </TableCell>
                          </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

            </div>
        )}

        {/*{warnings.length > 0 && (*/}
        {/*    <div dir="rtl">*/}
        {/*      <Alert className="bg-yellow-50 border-yellow-200 mb-2 max-w-3xl mx-auto">*/}
        {/*        <AlertTriangle className="h-4 w-4 text-yellow-500" />*/}
        {/*        <AlertTitle className="text-yellow-700">אזהרות</AlertTitle>*/}
        {/*        <AlertDescription className="text-yellow-600">*/}
        {/*          נמצאו {warnings.length} אזהרות. אנא שים לב לאזהרות הבאות:*/}
        {/*        </AlertDescription>*/}
        {/*      </Alert>*/}

        {/*      <div className="space-y-2 max-w-4xl mx-auto">*/}
        {/*        {warnings.map((warning, index) => (*/}
        {/*            <Alert key={index} className="bg-yellow-50 border-yellow-200">*/}
        {/*              <AlertDescription className="text-yellow-700">*/}
        {/*                {warning.message}*/}

        {/*                {warning.details && warning.details.length > 0 && (*/}
        {/*                    <ul className="mt-2 list-disc list-inside">*/}
        {/*                      {warning.details.map((detail, idx) => (*/}
        {/*                          <li key={idx} className="text-yellow-600">{detail}</li>*/}
        {/*                      ))}*/}
        {/*                    </ul>*/}
        {/*                )}*/}
        {/*              </AlertDescription>*/}
        {/*            </Alert>*/}
        {/*        ))}*/}
        {/*      </div>*/}
        {/*    </div>*/}
        {/*)}*/}
      </div>

);
};
