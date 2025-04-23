'use client'

import { useEffect, useState } from 'react'

import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { HoldingFeedLine } from '@/payload-types'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import { Button } from '../../components/ui/button'
import { FeedFatalError, FeedWarning } from '@/collections/holdings/feeds/FeedTypes'

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
  validRecords: HoldingFeedLine[]
  recordErrors: HoldingFeedLine[]
  warnings: FeedWarning[]
  fatals: FeedFatalError[]
  className?: string
  showConfirmButtons?: boolean
  onConfirm?: () => void
  onContinue?: () => void
  onCancel?: () => void
  isValidating?: boolean
  isUploading?: boolean
}

export function ProcessingResults({
  isSuccess,
  validRecords,
  recordErrors,
  warnings,
  fatals,
  className,
  showConfirmButtons = false,
  onConfirm,
  onCancel,
  isValidating = false,
}: ProcessingResultsProps) {
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('valid')
  const [isFinalized, setIsFinalized] = useState(false)
  const [shouldContinue, setShouldContinue] = useState(false)
  const [showWarningDialog, setShowWarningDialog] = useState(false)

  useEffect(() => {
    // Show warning dialog when warnings are present
    if (warnings.length > 0) {
      setShowWarningDialog(true)
    }
  }, [warnings])

  const handleFinalConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    setIsFinalized(true)
    setTimeout(() => {
      setIsFinalized(false)
    }, 1000)
  }

  const handleContinueWarning = () => {
    setShowWarningDialog(false)
    setShouldContinue(true)
  }

  const handleCancelWarning = () => {
    setShowWarningDialog(false)
    if (onCancel) {
      onCancel()
    }
  }

  // Show loading state
  if (isValidating) {
    return (
      <div className="flex flex-col h-[500px] items-center pt-[100px] ">
        <LoadingSpinnerDiamond />
      </div>
    )
  }

  // Show success state with no errors or warnings
  if (isFinalized) {
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
    <div className={className} dir="rtl">
      {/* Warnings Dialog */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader className="flex flex-row items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
            <DialogTitle className="text-xl text-red-600 m-0">אזהרה</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <p className="text-base font-medium mb-4">נמצאו מספר אזהרות בקובץ האחזקות:</p>

            <ul className="space-y-3">
              {warnings.map((warning, index) => (
                <li key={index} className="text-gray-800">
                  <span className="font-medium">{warning.message.replace(/$$\d+$$/g, '')}</span>

                  {warning.details && warning.details.length > 0 && (
                    <ul className="mt-2 pr-6 text-gray-700 list-disc list-inside">
                      {warning.details.map((detail, idx) => (
                        <li key={idx} className="text-sm">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={handleCancelWarning}>
              ביטול
            </Button>
            <Button onClick={handleContinueWarning}>המשך</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warnings Section */}
      {fatals.length > 0 && (
        <div className="mb-6" dir="rtl">
          <div className="bg-red-100 border border-red-300 rounded-2xl px-4 py-3 mb-4 max-w-3xl mx-auto shadow-md flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-700 mt-1" />
            <div>
              <AlertTitle className="text-red-900 font-bold text-lg">
                הקובץ שהוזן שגוי — הזנתו לא התקבלה!
              </AlertTitle>
              <AlertDescription className="text-red-800 text-sm space-y-3 mt-1">
                {fatals.map((warning, index) => (
                  <div key={index}>
                    {warning.message}
                    {warning.details && warning.details.length > 0 && (
                      <ul className="mt-2 list-disc list-inside">
                        {warning.details.map((detail, idx) => (
                          <li key={idx} className="text-red-700">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </AlertDescription>
            </div>
          </div>
        </div>
      )}

      {fatals.length === 0 && (shouldContinue || warnings.length === 0) && (
        <>
          {/* Tabs for Valid and Invalid Records */}
          <div className="mb-4">
            <div className="flex border-b">
              <button
                className={`px-4 py-2 font-medium ${
                  activeTab === 'valid'
                    ? 'border-b-2 border-green-500 text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('valid')}
              >
                אחזקות שנקלטו
              </button>
              <button
                className={`px-4 py-2 font-medium ${
                  activeTab === 'invalid'
                    ? 'border-b-2 border-red-500 text-red-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('invalid')}
              >
                שגויים {recordErrors.length > 0 && `(${recordErrors.length})`}
              </button>
            </div>
          </div>

          {/* Invalid Records Table */}
          {activeTab === 'invalid' && recordErrors.length > 0 && (
            <div className="mb-6">
              <div className="max-w-6xl mx-auto bg-white p-2 rounded-lg border border-red-200 shadow-sm">
                <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-md">
                  <Table className="w-full text-right border-collapse bg-white">
                    <TableHeader className="bg-red-100 sticky top-0 z-10 text-right">
                      <TableRow>
                        <TableHead className="text-right text-red-700 border px-3 py-2">
                          שורה
                        </TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">
                          נייר ערך
                        </TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">
                          חשבון
                        </TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">
                          כמות
                        </TableHead>
                        <TableHead className="text-right text-red-700 border px-3 py-2">
                          שגיאה
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recordErrors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell className="border px-3 py-2">
                            {error.lineNumber || 'N/A'}
                          </TableCell>
                          <TableCell className="border px-3 py-2">
                            {error.stockId || 'N/A'}
                          </TableCell>
                          <TableCell className="border px-3 py-2">
                            {error.accountId || 'N/A'}
                          </TableCell>
                          <TableCell className="border px-3 py-2">
                            {error.quantity || 'N/A'}
                          </TableCell>
                          <TableCell className="border px-3 py-2 text-red-600">
                            {error.error}
                          </TableCell>
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
              <div className="mb-6">
                <div className="max-w-6xl mx-auto bg-white p-2 rounded-lg border border-green-200 shadow-sm">
                  <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-md">
                    <Table className="w-full text-right border-collapse bg-white">
                      <TableHeader className="bg-green-50 sticky top-0 z-10 text-right">
                        <TableRow>
                          <TableHead className="text-right text-green-700 border px-3 py-2">
                            שורה
                          </TableHead>
                          <TableHead className="text-right text-green-700 border px-3 py-2">
                            נייר ערך
                          </TableHead>
                          <TableHead className="text-right text-green-700 border px-3 py-2">
                            חשבון
                          </TableHead>
                          <TableHead className="text-right text-green-700 border px-3 py-2">
                            כמות
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validRecords.map((record, index) => (
                          <TableRow key={index}>
                            <TableCell className="border px-3 py-2">
                              {record.lineNumber || 'N/A'}
                            </TableCell>
                            <TableCell className="border px-3 py-2">
                              {record.stockId || 'N/A'}
                            </TableCell>
                            <TableCell className="border px-3 py-2">
                              {record.accountId || 'N/A'}
                            </TableCell>
                            <TableCell className="border px-3 py-2">
                              {record.quantity || 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirm/Cancel Buttons */}
          {showConfirmButtons && (
            <div className="flex justify-end gap-3 mt-6 ml-[8%] rtl">
              <Button variant="secondary" onClick={onCancel} className="font-medium">
                ביטול
              </Button>
              <Button onClick={handleFinalConfirm} className="font-medium">
                שמירת האחזקות שנקלטו
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
