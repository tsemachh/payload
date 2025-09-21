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
import { SelectParentCompanyTree } from './SelectParentCompanyTree'
import { useCompaniesContext } from '../../context/companiesContext'
import { FundType } from '../../types/companies'
import { postWithErrorHandling } from '../../helpers/fetch-helpers'
import { handleAndNotifyError } from '../../helpers/error-handler'

interface AddSubAccountDialogProps {
  accountId: string | number
  companies: string[]
  allRecords: HoldingFeedLine[]
  onRefreshAction: (records: HoldingFeedLine[]) => void
}

export const AddSubAccountDialog: React.FC<AddSubAccountDialogProps> = ({
  accountId,
  companies,
  allRecords,
  onRefreshAction,
}) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const { funds } = useCompaniesContext()

  const handleClose = () => {
    setOpen(false)
    setResultMessage(null)
    setSelectedCompanyId(null)
  }

  const companyIdsSet = new Set<string>(companies)

  const companyOptions =
    funds
      ?.filter((company): company is FundType => {
        return (
          typeof company === 'object' &&
          !!company.id &&
          !!company.name &&
          companyIdsSet.has(company.id)
        )
      })
      .map((company) => ({
        id: company.id,
        label: company.name,
      })) ?? []

  const handleAddSubAccount = async () => {
    if (!selectedCompanyId) return
    setLoading(true)
    try {
      const response = await postWithErrorHandling(
        `/api/companies/add-sub-account?companyId=${selectedCompanyId}`,
        { accountId },
        {
          errorMessage: 'שגיאה בהוספת החשבון',
          notifyOnError: true,
        },
      )

      if (response) {
        setResultMessage('החשבון נוסף בהצלחה!')
        setTimeout(() => {
          onRefreshAction(allRecords)
        }, 2000)
      } else {
        setResultMessage(null)
      }
    } catch (error) {
      handleAndNotifyError(error, 'שגיאה בהוספת חשבון')
      setResultMessage(null)
      handleClose()
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
        className="w-[60px] bg-transparent text-dark border border-inherit hover:bg-muted hover:text-dark transition-colors"
        onClick={() => setOpen(true)}
      >
        הוספה
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-background text-foreground border border-border shadow-lg rounded-lg">
          <DialogHeader>
            <DialogTitle className="direction-rtl text-right">הוספת חשבון עבור תיק</DialogTitle>
          </DialogHeader>

          {resultMessage ? (
            <div className="text-center text-lg font-medium py-4">{resultMessage}</div>
          ) : (
            <>
              <SelectParentCompanyTree
                companies={companyOptions}
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
