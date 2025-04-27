'use client'

import { useEffect, useState } from 'react'

import { XCircle, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HoldingFeedLine } from '@/payload-types'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import { Button } from '../../components/ui/button'
import { FeedFatalError, FeedWarning } from '@/collections/holdings/feeds/FeedTypes'
import { RecordsTable } from './RecordsTable'

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
  setIsSuccess: (v: boolean) => void
  validRecords: HoldingFeedLine[]
  recordErrors: HoldingFeedLine[]
  warnings: FeedWarning[]
  fatals: FeedFatalError[]
  className?: string
  onConfirm?: () => void
  onContinue?: () => void
  onCancel?: () => void
  isValidating?: boolean
  isUploading?: boolean
}

export function ProcessingResults({
  isSuccess,
  setIsSuccess,
  validRecords,
  recordErrors,
  warnings,
  fatals,
  className,
  onConfirm,
  onCancel,
  isValidating = false,
}: ProcessingResultsProps) {
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('valid')
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
      setIsSuccess(true)
      onConfirm()
    }
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
        <p className="text-center">מעבד נתונים...</p>
      </div>
    )
  }
  if (isSuccess) {
    return (
      <div className="flex flex-col h-[500px] items-center pt-[100px] ">
        <LoadingSpinnerDiamond />
        <p className="text-center">שומר נתונים...</p>
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
            <p className="text-base font-medium mb-4">נמצאו מספר בעיות בקובץ האחזקות:</p>

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
      <Dialog open={fatals.length > 0} onOpenChange={handleCancelWarning}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader className="flex flex-row items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
            <DialogTitle className="text-xl text-red-600 m-0">
              הקובץ שהוזן שגוי — ההזנה לא התקבלה!
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <ul className="space-y-3">
              {fatals.map((error, index) => (
                <li key={index} className="text-gray-800">
                  <span className="font-medium">{error.message}</span>

                  {error.details && error.details.length > 0 && (
                    <ul className="mt-2 pr-6 text-gray-700 list-disc list-inside">
                      {error.details.map((detail, idx) => (
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
            <Button onClick={handleCancelWarning}>חזרה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                אחזקות שנקלטו {validRecords.length > 0 && `(${validRecords.length})`}
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
            <RecordsTable records={recordErrors} invalid={true} />
          )}

          {/* Valid Records Message */}
          {activeTab === 'valid' && <RecordsTable records={validRecords} />}

          {/* Confirm/Cancel Buttons */}
          <div className="flex justify-end gap-3 mt-6 ml-[8%] rtl">
            <Button variant="secondary" onClick={onCancel} className="font-medium">
              ביטול
            </Button>
            <Button onClick={handleFinalConfirm} className="font-medium">
              שמירת האחזקות תקינות
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
