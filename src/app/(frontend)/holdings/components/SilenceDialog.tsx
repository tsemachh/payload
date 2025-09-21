'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HoldingFeedLine } from '@/payload-types'
import { postWithErrorHandling } from '../../helpers/fetch-helpers'
import { handleAndNotifyError } from '../../helpers/error-handler'

interface SilenceDialogProps {
  stockIds: (string | number)[]
  companies: string[]
  allRecords: HoldingFeedLine[]
  onRefreshAction: (records: HoldingFeedLine[]) => void
  open: boolean
  onClose: () => void
}

export const SilenceDialog: React.FC<SilenceDialogProps> = ({
  stockIds,
  companies,
  allRecords,
  onRefreshAction,
  open,
  onClose,
}: SilenceDialogProps) => {
  const [loading, setLoading] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const handleSilence = async () => {
    setLoading(true)
    try {
      const response = await postWithErrorHandling(
        `/api/silenced-stocks/upsert?companies=${companies}`,
        { stockIds },
        {
          errorMessage: 'שגיאה בהשתקת ניירות הערך',
          notifyOnError: true,
        },
      )
      if (response) {
        const count = stockIds.length
        setResultMessage(`${count} ניירות הוספו לניירות מושתקים בהצלחה!`)
        setTimeout(() => {
          onRefreshAction(allRecords)
        }, 2000)
      } else {
        setResultMessage('נכשל להשתיק את השגיאות.')
      }
    } catch (error) {
      handleAndNotifyError(error, 'נכשל להשתיק את השגיאות.')
      setResultMessage('נכשל להשתיק את השגיאות.')
    } finally {
      setLoading(false)
      setTimeout(() => {
        setResultMessage(null)
        onClose()
      }, 2000)
    }
  }

  const stockCount = stockIds.length

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        setResultMessage(null)
        onClose()
      }}
    >
      <DialogContent className="bg-background text-foreground border border-border shadow-lg rounded-lg">
        <DialogHeader>
          <DialogTitle className="direction-rtl text-right">
            {stockCount === 1
              ? 'האם בטוח שברצונך להשתיק את נייר הערך?'
              : `האם בטוח שברצונך להשתיק ${stockCount} ניירות ערך?`}
          </DialogTitle>
        </DialogHeader>

        {resultMessage ? (
          <div className="text-center text-lg font-medium py-4">{resultMessage}</div>
        ) : (
          <DialogFooter className="flex justify-end gap-4">
            <Button
              variant="outline"
              className="bg-transparent text-inherit border border-inherit hover:bg-muted transition-colors"
              onClick={() => {
                setResultMessage(null)
                onClose()
              }}
            >
              ביטול
            </Button>
            <Button
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={handleSilence}
              disabled={loading}
            >
              {loading ? 'מעדכן...' : 'אישור'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
