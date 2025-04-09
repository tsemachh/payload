'use client'

import { useState } from 'react'
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
  showConfirmButtons?: boolean
  onConfirm?: () => void
  onCancel?: () => void
  isValidating?: boolean
  isUploading?: boolean
}

export function ProcessingResults({ 
  isSuccess,
  errors,
  warnings, 
  className,
  showConfirmButtons = false,
  onConfirm,
  onCancel,
  isValidating = false,
  isUploading = false
}: ProcessingResultsProps) {
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('invalid');

  // Show loading state
  if (isValidating || isUploading) {
    return (
      <div className={className}>
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-700">{isValidating ? 'בודק...' : 'מעלה...'}</AlertTitle>
          <AlertDescription className="text-blue-600">
            {isValidating ? 'בודק את קובץ האחזקות, אנא המתן.' : 'מעלה את קובץ האחזקות, אנא המתן.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show success state with no errors or warnings
  if (isSuccess && errors.length === 0 && warnings.length === 0 && !showConfirmButtons) {
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
    );
  }

  return (
    <div className={className} dir="rtl">
      {/* Warnings Section */}
      {warnings.length > 0 && (
        <div className="mb-6">
          <Alert className="bg-yellow-50 border-yellow-200 mb-4 max-w-3xl mx-auto">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-700">שים לב</AlertTitle>
            <AlertDescription className="text-yellow-600">
              נמצאו {warnings.length} אזהרות. אנא שים לב לאזהרות הבאות:
            </AlertDescription>
          </Alert>

          <div className="space-y-2 max-w-4xl mx-auto">
            {warnings.map((warning, index) => (
              <Alert key={index} className="bg-yellow-50 border-yellow-200">
                <AlertDescription className="text-yellow-700">
                  {warning.message}
                  {warning.count && <span> ({warning.count})</span>}

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

      {/* Tabs for Valid and Invalid Records */}
      <div className="mb-4">
        <div className="flex border-b">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'invalid'
                ? 'border-b-2 border-red-500 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('invalid')}
          >
            שגויים {errors.length > 0 && `(${errors.length})`}
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'valid'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('valid')}
          >
            תקינים
          </button>
        </div>
      </div>

      {/* Invalid Records Table */}
      {activeTab === 'invalid' && errors.length > 0 && (
        <div className="mb-6">
          <div className="max-w-6xl mx-auto bg-white p-2 rounded-lg border border-red-200 shadow-sm">
            <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-md">
              <Table className="w-full text-right border-collapse bg-white">
                <TableHeader className="bg-red-100 sticky top-0 z-10 text-right">
                  <TableRow>
                    <TableHead className="text-right text-red-700 border px-3 py-2">שורה</TableHead>
                    <TableHead className="text-right text-red-700 border px-3 py-2">נייר ערך</TableHead>
                    <TableHead className="text-right text-red-700 border px-3 py-2">חשבון</TableHead>
                    <TableHead className="text-right text-red-700 border px-3 py-2">כמות</TableHead>
                    <TableHead className="text-right text-red-700 border px-3 py-2">שגיאה</TableHead>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Valid Records Message */}
      {activeTab === 'valid' && (
        <div className="mb-6">
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700">רשומות תקינות</AlertTitle>
            <AlertDescription className="text-green-600">
              הרשומות התקינות יישמרו במערכת אם תאשר את ההזנה.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Confirm/Cancel Buttons */}
      {showConfirmButtons && (
        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md border border-gray-300"
          >
            לבטל
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
          >
            לשמור
          </button>
        </div>
      )}
    </div>
  );
};
