'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface SilenceDialogProps {
  stockId: string | number
  onSuccess?: () => void
  companies: string[]
}

export const SilenceDialog: React.FC<SilenceDialogProps> = ({ stockId, onSuccess,companies }) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const handleSilence = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/silenced-stocks/upsert?stockId=${stockId}&companies=${companies}`, {
        method: 'POST',
      })
      if (response.ok) {
        setResultMessage('הנייר הוסף לניירות מושתקים בהצלחה!')
        onSuccess?.()
      } else {
        setResultMessage('נכשל להשתיק את השגיאה.')
      }
    } catch (error) {
      console.error('שגיאה בהשתקה', error)
      setResultMessage('נכשל להשתיק את השגיאה.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setResultMessage(null)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-transparent text-dark border border-inherit hover:bg-muted hover:text-dark transition-colors"
        onClick={() => setOpen(true)}
      >
        להשתיק
      </Button>


      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-background text-foreground border border-border shadow-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>האם את/ה בטוח/ה שברצונך להשתיק את נייר הערך?</DialogTitle>
          </DialogHeader>

          {resultMessage ? (
            <div className="text-center text-lg font-medium py-4">{resultMessage}</div>
          ) : (
            <DialogFooter className="flex justify-end gap-4">
              <Button
                variant="outline"
                className="bg-transparent text-inherit border border-inherit hover:bg-muted transition-colors"
                onClick={handleClose}
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
    </>
  )
}
