'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HoldingFeedLine } from '@/payload-types'
import { SelectParentCompanyTree } from './SelectParentCompanyTree'

interface AddSubAccountDialogProps {
  accountId: string | number
  companies: string[]
  allRecords: HoldingFeedLine[]
  onRefresh: (records: HoldingFeedLine[]) => void
}

export const AddSubAccountDialog: React.FC<AddSubAccountDialogProps> = ({
                                                                          accountId,
                                                                          companies,
                                                                          allRecords,
                                                                          onRefresh,
                                                                        }) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const handleClose = () => {
    setOpen(false)
    setResultMessage(null)
    setSelectedCompanyId(null)
  }

  const handleAddSubAccount = async () => {
    if (!selectedCompanyId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/accounts/addSubAccount?accountId=${accountId}&companyId=${selectedCompanyId}`, {
        method: 'POST',
      })

      if (response.ok) {
        setResultMessage('החשבון נוסף בהצלחה!')
        setTimeout(() => {
          onRefresh(allRecords)
        }, 2000)
      } else {
        setResultMessage('נכשל להוסיף את החשבון.')
      }
    } catch (error) {
      console.error('שגיאה בהוספת החשבון:', error)
      setResultMessage('שגיאה כללית בהוספה.')
    } finally {
      setLoading(false)
      setTimeout(() => {
        handleClose()
      }, 2000)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-transparent text-dark border border-inherit hover:bg-muted hover:text-dark transition-colors"
        onClick={() => setOpen(true)}
      >
        הוספה
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-background text-foreground border border-border shadow-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>האם להוסיף את החשבון לחברה שנבחרה?</DialogTitle>
          </DialogHeader>

          {resultMessage ? (
            <div className="text-center text-lg font-medium py-4">{resultMessage}</div>
          ) : (
            <>
              <SelectParentCompanyTree
                companies={companies}
                onSelect={(id) => setSelectedCompanyId(id)}
              />

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
                  onClick={handleAddSubAccount}
                  disabled={loading || !selectedCompanyId}
                >
                  {loading ? 'מוסיף...' : 'אישור'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
