'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmationDialog } from '@/app/(frontend)/components/ui/confirmation-dialog'
import { CheckboxFilter } from '@/collections/votes/components/CheckboxFilter'
import { formatDateTime } from '@/app/(frontend)/helpers/utils-data-table'
import { formatNumberWithLocale } from '@/utils/numberUtils'
import { ReportApprovalUpload } from './uploadApproval'
import { OwnedQuantityInput } from './OwnedQuantityInput'
import { Trash2, Copy } from 'lucide-react'
import { toast } from '@payloadcms/ui'
import { HoldingsDetailsTooltip } from './HoldingsDetailsTooltip'

export interface VoteData {
  fundsData: Array<{
    company: { id: string; name: string; _order?: string }
    fund: { id: string; name: string; _order?: string }
    holdingDate: string
    quantity: number
    ownedQuantity?: number
    verifiedHoldings: boolean
    fromRelatedStock?: boolean
    original?: {
      stockId: string
      quantity: number
      ownedQuantity: number
      verifiedHoldings: boolean
    }
  }>
  companies?: string[]
  companyIds?: string[]
  id: string
  title: string
  company: string
  displayVotingRecommendation: boolean
  meeting: string
  meetingDate: string
  meetingStockNum: string
  meetingStockId: string
  holdingsLimit: string
  finalized: boolean
  isInterested: boolean
  interestedExplanation?: string
  isSeniorOfficial: boolean
  seniorOfficialExplanation?: string
  isInstitutionalInvestor: boolean
  voteAgainstRecommendation: boolean
  voteDifferentFromResult: boolean
  reported: boolean
  reportApproval?: File
  clientComment?: string
  voteDocuments?: Array<{
    id: string
    filename: string
    url: string
  }>
  dynamicQuestions?: Array<{
    questionId: string
    questionText: string
    answer: boolean
    explanation?: string
  }>
  votes: Array<{
    voteDecision?: string
    voteReason?: string
    hasConflictOfInterest: boolean
    isRelatedParty: boolean
    isInvestmentCommittee: boolean
    hasPersonalInterest: boolean
    id: string
    conflictOfInterestExplanation?: string
    relatedPartyExplanation?: string
    personalInterestExplanation?: string
  }>
  agenda?: Array<{
    text: string
    id: string
    result: string
    majorityType: string
    recommendation?: {
      votingRecommendation: string | null
      reasonText: string | null
    }
    isRemovedFromAgenda?: boolean
  }>
}

interface VotingFormProps {
  voteData: VoteData
  meetingId: string
}

export function VotingForm({ voteData, meetingId }: VotingFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<VoteData>()
  const [initialFormData, setInitialFormData] = useState<VoteData>()
  const [hasChanges, setHasChanges] = useState(false)
  const [hasErrors, setHasErrors] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [fundToRemoveIndex, setFundToRemoveIndex] = useState<number | null>(null)
  const [removingFundIndex, setRemovingFundIndex] = useState<number | null>(null)

  // Calculate which funds should show remove button based on company fund count
  const fundRemoveability = useMemo(() => {
    if (!formData) return new Map<string, boolean>()

    // Count funds per company
    const companyFundCounts = new Map<string, number>()
    formData.fundsData.forEach((fund) => {
      const companyId = fund.company.id
      companyFundCounts.set(companyId, (companyFundCounts.get(companyId) || 0) + 1)
    })

    // Create map of fund keys to removability
    const removeabilityMap = new Map<string, boolean>()
    formData.fundsData.forEach((fund) => {
      const key = `${fund.company.id}-${fund.fund.id}`
      const companyFundCount = companyFundCounts.get(fund.company.id) || 0
      removeabilityMap.set(key, companyFundCount > 1)
    })

    return removeabilityMap
  }, [formData])

  // Check if any fund can be removed (to determine if column should be shown)
  const shouldDisplayRemoveColumn = useMemo(() => {
    return (
      !voteData.finalized && Array.from(fundRemoveability.values()).some((canRemove) => canRemove)
    )
  }, [fundRemoveability])

  const allHoldingsVerified = useMemo(() => {
    if (!formData) return false

    return formData.fundsData.every((fund) => {
      const displayData = fund.original ?? fund

      // If verified (true), it's valid
      if (displayData?.verifiedHoldings === true) {
        return true
      }

      // If not verified (false), it must have an ownedQuantity value
      if (displayData?.verifiedHoldings === false) {
        return displayData?.ownedQuantity && displayData.ownedQuantity > 0
      }

      return false
    })
  }, [formData])

  useEffect(() => {
    if (!voteData) return
    setFormData(JSON.parse(JSON.stringify(voteData)))
    setInitialFormData(JSON.parse(JSON.stringify(voteData))) // Deep copy for comparison
  }, [voteData])

  useEffect(() => {
    // Function to check theme
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      setIsDarkMode(theme === 'dark')
    }
    // Check initial theme
    checkTheme()
  }, [])

  // Function to check if form has changes
  const checkForChanges = (currentData: VoteData, originalData: VoteData) => {
    if (!currentData || !originalData) return false

    // Compare reported status
    if (
      currentData.reported !== originalData.reported ||
      (currentData.reportApproval as any)?.id !== (originalData.reportApproval as any)?.id
    )
      return true

    // Compare funds data using JSON.stringify
    return JSON.stringify(currentData.fundsData) !== JSON.stringify(originalData.fundsData)
  }

  const checkInvalidData = (formData: VoteData) => {
    const hasInvalidData = formData.fundsData.some((fund) => {
      const hasOriginal = fund.original
      const displayData = hasOriginal ? fund.original : fund

      if (displayData?.verifiedHoldings === false) {
        return !displayData?.ownedQuantity || displayData.ownedQuantity <= 0
      }
      return false
    })
    return hasInvalidData
  }

  // Update hasChanges whenever formData changes
  useEffect(() => {
    if (formData && initialFormData) {
      setHasChanges(checkForChanges(formData, initialFormData))
      setHasErrors(checkInvalidData(formData))
    }
  }, [formData, initialFormData])

  const handleSave = async () => {
    // Validate funds data before saving
    if (!formData) return

    if (hasErrors) {
      return
    }

    const fundsWithHolding = formData?.fundsData.map((fund) => {
      return {
        company: fund.company.id,
        fund: fund.fund.id,
        fundName: fund.fund.name,
        ownedQuantity: fund.ownedQuantity,
        quantity: fund.quantity,
        verifiedHoldings: fund.verifiedHoldings,
        original: fund.original,
      }
    })
    const reqBody = {
      meetingId,
      meetingName: voteData.meeting,
      companyIds: voteData.companyIds || [],
      votesData: {
        reported: formData?.reported,
        reportApproval: formData?.reportApproval,
        fundsWithHolding,
      },
    }
    setIsLoading(true)
    try {
      const response = await fetch(`/api/votes/update-grouped-votes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
      })

      if (!response.ok) {
        throw new Error('Failed to save vote data')
      }

      console.log('Vote data saved successfully')
      router.back()
    } catch (error) {
      console.error('Error saving vote data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateFundData = (index: number, field: string, value: any) => {
    if (!formData) return

    const booleanValue = value === 'checked' ? true : value === 'unchecked' ? false : null
    const updatedFunds = [...formData.fundsData]
    if (booleanValue) {
      updatedFunds[index].ownedQuantity = undefined
    }
    if (field.startsWith('original.')) {
      // Handle nested original fields
      const originalField = field.replace('original.', '')
      const currentOriginal = updatedFunds[index].original || ({} as any)
      if (booleanValue) {
        currentOriginal.ownedQuantity = undefined
      }
      const numericValue =
        originalField === 'ownedQuantity'
          ? Number.parseFloat(value.replace(/,/g, ''))
          : booleanValue
      updatedFunds[index] = {
        ...updatedFunds[index],
        original: {
          ...currentOriginal,
          [originalField]: numericValue,
        },
      }
    } else {
      // Handle regular fields
      const numericValue =
        field === 'ownedQuantity' ? Number.parseFloat(value.replace(/,/g, '')) : booleanValue
      updatedFunds[index] = { ...updatedFunds[index], [field]: numericValue }
    }

    const newFormData = { ...formData, fundsData: updatedFunds }
    setFormData(newFormData)
  }

  const getVoteResultColor = (result: string) => {
    switch (result) {
      case 'בעד':
        return 'text-green-700 bg-green-100 border-green-200 dark:text-green-800 dark:bg-green-100 dark:border-green-200'
      case 'נגד':
        return 'text-red-700 bg-red-100 border-red-200 dark:text-red-800 dark:bg-red-100 dark:border-red-200'
      case 'נמנע':
        return 'text-blue-700 bg-blue-100 border-blue-200 dark:text-blue-800 dark:bg-blue-100 dark:border-blue-200'
      default:
        return 'text-gray-700 bg-gray-100 border-gray-200 dark:text-gray-800 dark:bg-gray-100 dark:border-gray-200'
    }
  }

  const getAgendaItemColor = (result: boolean) => {
    if (result === true) {
      return 'text-green-700 bg-green-100 border-green-200 dark:text-green-800 dark:bg-green-100 dark:border-green-200'
    } else if (result === false) {
      return 'text-red-700 bg-red-100 border-red-200 dark:text-red-800 dark:bg-red-100 dark:border-red-200'
    } else {
      return 'text-gray-700 bg-gray-100 border-gray-200 dark:text-gray-800 dark:bg-gray-100 dark:border-gray-200'
    }
  }
  const isOriginal =
    formData?.fundsData.some((fund) => fund.original) &&
    formData.fundsData.some((fund) => fund.fromRelatedStock)

  const saveDraftData = (label: string, updatedData: any) => {
    console.log(`Draft saved for ${label}`, updatedData)
    setFormData(updatedData)
  }

  const handleRemoveFund = (sortedIndex: number) => {
    setFundToRemoveIndex(sortedIndex)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('הועתק ללוח')
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('שגיאה בהעתקה')
    }
  }

  const confirmRemoveFund = async () => {
    if (fundToRemoveIndex === null || !formData) return

    const fundToDelete = formData.fundsData[fundToRemoveIndex]

    // Set the removing state and close dialog
    setRemovingFundIndex(fundToRemoveIndex)
    setFundToRemoveIndex(null)

    try {
      const response = await fetch(`/api/meetings/removeFund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          companyId: fundToDelete.company.id,
          fundId: fundToDelete.fund.id,
          ...(fundToDelete.original?.stockId && { originalStockId: fundToDelete.original.stockId }),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Failed to remove fund:', result.message)
        toast.error(`שגיאה בהסרת התיק ${result.message}`)
        setRemovingFundIndex(null)
        return
      }

      console.log('Fund removed successfully:', result.message)

      // Update local state by removing the fund
      const updatedFunds = formData.fundsData.filter((fund) => {
        if (fundToDelete.original) {
          return !(
            fund.company.id === fundToDelete.company.id &&
            fund.fund.id === fundToDelete.fund.id &&
            fund.original?.stockId === fundToDelete.original.stockId
          )
        }
        return !(
          fund.company.id === fundToDelete.company.id && fund.fund.id === fundToDelete.fund.id
        )
      })

      const newFormData = { ...formData, fundsData: updatedFunds }
      setFormData(newFormData)
      setInitialFormData(newFormData)
      setRemovingFundIndex(null)
    } catch (error) {
      console.error('Error removing fund:', error)
      toast.error(`שגיאה בהסרת התיק ${error}`)
      setRemovingFundIndex(null)
    }
  }

  return formData ? (
    <div
      className={`useTw ${isDarkMode ? 'dark' : ''} space-y-3 p-4 max-w-[80%] print:max-w-full text-gray-900 dark:text-white`}
      dir="rtl"
    >
      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
        <CardHeader className="pb-6">
          <CardTitle className="text-center text-xl font-bold text-gray-900 dark:text-white">
            {voteData.meeting}
          </CardTitle>
          <div className="flex items-center text-base text-gray-700 dark:text-gray-200 gap-12 justify-center pt-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">תאריך האסיפה:</span>
              <span>{formatDateTime(formData.meetingDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">מועד קובע:</span>
              <span>{formatDateTime(formData.holdingsLimit)}</span>
            </div>
          </div>
          <CardTitle className="text-right text-base text-gray-900 dark:text-white">
            חברות
          </CardTitle>
          <div className="flex flex-wrap gap-2 text-right">
            {formData.companies?.map((company, index) => (
              <div
                key={index}
                className="bg-muted dark:bg-gray-800 rounded-full px-4 py-1 flex items-center"
              >
                <span className="text-base font-medium text-gray-900 dark:text-white">
                  {company}
                </span>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
        <CardContent>
          <div className="flex items-center justify-start space-x-reverse space-x-2 pt-6 pb-4">
            <div
              className="flex items-center"
              title={
                !allHoldingsVerified ? 'לא ניתן לסמן הצבעה בפועל לפני אימות החזקות לכל התיקים' : ''
              }
            >
              <Checkbox
                checked={formData.reported}
                disabled={!allHoldingsVerified}
                onCheckedChange={(checked) => setFormData({ ...formData, reported: !!checked })}
              />
              <label
                className={`text-base font-medium mr-3 ${
                  allHoldingsVerified
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                הצבעה בפועל
              </label>
            </div>

            <ReportApprovalUpload
              formData={formData}
              setFormDataAction={setFormData}
              saveDraftDataAction={saveDraftData}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="text-base">
                <TableHead className="text-right w-64 text-gray-900 dark:text-white">
                  חברה
                </TableHead>
                <TableHead className="text-right w-80 text-gray-900 dark:text-white">
                  שם תיק
                </TableHead>
                {isOriginal && (
                  <TableHead className="text-right w-32 text-gray-900 dark:text-white">
                    נייר עוקב
                  </TableHead>
                )}
                <TableHead className="text-right w-32 text-gray-900 dark:text-white">
                  ערך נקוב במערכת
                </TableHead>
                <TableHead className="text-right w-24 text-gray-900 dark:text-white">
                  אימות החזקות
                </TableHead>
                <TableHead className="text-right w-32 text-gray-900 dark:text-white">
                  ערך נקוב ברשות
                </TableHead>
                {shouldDisplayRemoveColumn && (
                  <TableHead className="text-center w-16 text-gray-900 dark:text-white print:hidden">
                    הסרה
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.fundsData.map((fund, index) => {
                const hasOriginal = fund.original
                const displayData = hasOriginal ? fund.original : fund
                const fundKey = `${fund.company.id}-${fund.fund.id}`
                const canRemoveFund = fundRemoveability.get(fundKey) || false
                return (
                  <TableRow
                    key={index}
                    className="text-base border-b border-gray-100 dark:border-gray-800"
                  >
                    <TableCell className="text-right font-medium text-base text-gray-900 dark:text-white">
                      {fund.company.name}
                    </TableCell>
                    <TableCell className="text-right text-base text-gray-900 dark:text-white">
                      {fund.fund.name}
                    </TableCell>
                    {isOriginal && (
                      <TableCell className="text-right text-base text-gray-900 dark:text-white">
                        {fund.original?.stockId != voteData.meetingStockNum
                          ? fund.original?.stockId
                          : ''}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end w-fit">
                        <HoldingsDetailsTooltip
                          fundId={fund.fund.id}
                          stockId={voteData.meetingStockId}
                          holdingDate={fund.holdingDate || voteData.holdingsLimit}
                        />
                        <span className="text-gray-600 dark:text-gray-300 text-base">
                          {displayData?.quantity && formatNumberWithLocale(displayData.quantity)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <CheckboxFilter
                          value={
                            displayData?.verifiedHoldings === false
                              ? 'unchecked'
                              : displayData?.verifiedHoldings === true
                                ? 'checked'
                                : 'indeterminate'
                          }
                          onChangeAction={(state) =>
                            updateFundData(
                              index,
                              hasOriginal ? 'original.verifiedHoldings' : 'verifiedHoldings',
                              state,
                            )
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="h-[44px] flex items-center justify-right w-fit">
                        {displayData?.verifiedHoldings === true ? (
                          <span className="text-gray-600 dark:text-gray-300 text-base">
                            {displayData?.quantity && formatNumberWithLocale(displayData.quantity)}
                          </span>
                        ) : (
                          <div className="w-full">
                            <OwnedQuantityInput
                              value={displayData?.ownedQuantity}
                              verifiedHoldings={displayData?.verifiedHoldings}
                              onChangeAction={(value) =>
                                updateFundData(
                                  index,
                                  hasOriginal ? 'original.ownedQuantity' : 'ownedQuantity',
                                  value,
                                )
                              }
                              isVisible={
                                !(
                                  displayData?.verifiedHoldings ||
                                  displayData?.verifiedHoldings === undefined ||
                                  displayData?.verifiedHoldings === null
                                )
                              }
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {shouldDisplayRemoveColumn && (
                      <TableCell className="text-center print:hidden">
                        {canRemoveFund ? (
                          removingFundIndex === index ? (
                            <div className="flex justify-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600 dark:border-red-400" />
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRemoveFund(index)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="הסר תיק"
                              disabled={removingFundIndex !== null}
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )
                        ) : null}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/50 dark:bg-gray-800/70 font-bold">
                <TableCell
                  className="text-right text-base text-gray-900 dark:text-white"
                  colSpan={isOriginal ? 3 : 2}
                >
                  סה״כ
                </TableCell>
                <TableCell className="text-right text-base text-gray-900 dark:text-white">
                  {formatNumberWithLocale(
                    formData.fundsData.reduce((sum, fund) => {
                      const displayData = fund.original || fund
                      return sum + (displayData?.quantity || 0)
                    }, 0),
                  )}
                </TableCell>
                <TableCell />
                <TableCell className="text-right text-base text-gray-900 dark:text-white">
                  {(() => {
                    const hasNullVerification = formData.fundsData.some((fund) => {
                      const displayData = fund.original || fund
                      return (
                        displayData?.verifiedHoldings === null ||
                        displayData?.verifiedHoldings === undefined
                      )
                    })

                    if (hasNullVerification) {
                      return '-'
                    }

                    return formatNumberWithLocale(
                      formData.fundsData.reduce((sum, fund) => {
                        const displayData = fund.original || fund

                        if (displayData?.verifiedHoldings) {
                          return sum + (displayData?.quantity || 0)
                        }

                        if (displayData?.verifiedHoldings === false) {
                          const ownedQty = displayData?.ownedQuantity
                          return sum + (ownedQty ? ownedQty : 0)
                        }

                        return sum
                      }, 0),
                    )
                  })()}
                </TableCell>
                {shouldDisplayRemoveColumn && <TableCell className="print:hidden" />}
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {shouldDisplayRemoveColumn && (
        <ConfirmationDialog
          open={fundToRemoveIndex !== null}
          onOpenChange={() => setFundToRemoveIndex(null)}
          onConfirm={confirmRemoveFund}
          title="הסרת תיק"
          description={`פעולה זו תסיר את תיק ${fundToRemoveIndex !== null ? formData.fundsData[fundToRemoveIndex]?.fund.name : ''}`}
        />
      )}
      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
        <CardContent className="space-y-3">
          {formData.dynamicQuestions && formData.dynamicQuestions.length > 0 ? (
            // Show dynamic questions
            <div className="grid grid-cols-3 gap-4 pt-6 text-base items-start">
              {formData.dynamicQuestions.map((question, index) => (
                <div key={question.questionId} className="flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <label className="text-gray-900 dark:text-white font-medium">
                      {question.questionText}
                    </label>
                    <Checkbox checked={question.answer} disabled={true} />
                  </div>
                  {question.answer && question.explanation && (
                    <span className="text-gray-700 dark:text-gray-300 text-sm mt-1" dir="rtl">
                      {question.explanation}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Show default static questions
            <div className="grid grid-cols-3 gap-4 pt-6 text-base items-start">
              <div className="flex flex-col">
                <div className="flex items-center space-x-reverse space-x-2 justify-start">
                  <label className="text-gray-900 dark:text-white font-medium ml-3">
                    בעל עניין
                  </label>
                  <Checkbox checked={formData.isInterested} disabled={true} />
                </div>
                {formData.isInterested && formData.interestedExplanation && (
                  <span className="text-gray-700 dark:text-gray-300 text-sm mt-1" dir="rtl">
                    {formData.interestedExplanation}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-reverse space-x-2 justify-start">
                  <label className="text-gray-900 dark:text-white font-medium ml-3">
                    נושא משרה בכירה
                  </label>
                  <Checkbox checked={formData.isSeniorOfficial} disabled={true} />
                </div>
                {formData.isSeniorOfficial && formData.seniorOfficialExplanation && (
                  <span className="text-gray-700 dark:text-gray-300 text-sm mt-1" dir="rtl">
                    {formData.seniorOfficialExplanation}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-reverse space-x-2 justify-start">
                  <label className="text-gray-900 dark:text-white font-medium ml-3">
                    משקיע מוסדי
                  </label>
                  <Checkbox checked={formData.isInstitutionalInvestor} disabled={true} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-base text-gray-900 dark:text-white">
            סדר יום להצבעה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="text-base">
                <TableHead className="text-right text-gray-900 dark:text-white">נושא</TableHead>
                {formData.displayVotingRecommendation && (
                  <TableHead className="text-right w-32 text-gray-900 dark:text-white">
                    המלצה
                  </TableHead>
                )}
                <TableHead className="text-right w-32 text-gray-900 dark:text-white">
                  הצבעה
                </TableHead>
                <TableHead className="text-right max-w-64 text-gray-900 dark:text-white">
                  נימוק הצבעה
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(formData.agenda || []).map((item, index) => {
                const voteItem = voteData.votes[index]
                return (
                  <TableRow
                    key={item.id}
                    className="text-base border-b border-gray-100 dark:border-gray-800"
                  >
                    <TableCell className="text-right">
                      <div className="flex items-start gap-2">
                        <span className="text-base font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                          {index + 1}.
                        </span>
                        <div className="flex-1 flex flex-col gap-4">
                          <div
                            className={`text-base text-gray-900 dark:text-white ${
                              /[\u0590-\u05FF]/.test(item.text) ? 'text-right' : 'text-left'
                            }`}
                            style={item.isRemovedFromAgenda ? { color: 'gray' } : {}}
                            dir={/[\u0590-\u05FF]/.test(item.text) ? 'rtl' : 'ltr'}
                          >
                            <span
                              style={
                                item.isRemovedFromAgenda ? { textDecoration: 'line-through' } : {}
                              }
                            >
                              {item.text}
                            </span>
                            {item.isRemovedFromAgenda && (
                              <span
                                style={{
                                  textDecoration: 'none',
                                  color: 'gray',
                                  marginLeft: '4px',
                                }}
                              >
                                {/[\u0590-\u05FF]/.test(item.text)
                                  ? '(הוסר מסדר היום)'
                                  : '(Removed from agenda)'}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 flex-wrap" dir="rtl">
                            <div className="flex flex-col w-[160px] print:w-auto">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-900 dark:text-white text-sm font-medium">
                                  ניגוד עניינים:
                                </span>
                                <div
                                  className={`px-2 py-0.5 rounded text-sm font-medium ${getAgendaItemColor(voteItem?.hasConflictOfInterest)}`}
                                >
                                  {voteItem?.hasConflictOfInterest ? 'כן' : 'לא'}
                                </div>
                              </div>
                              {voteItem?.hasConflictOfInterest &&
                                voteItem?.conflictOfInterestExplanation && (
                                  <div className="flex items-start gap-1 mt-1">
                                    <span
                                      className="text-gray-700 dark:text-gray-300 text-sm flex-1"
                                      dir="rtl"
                                    >
                                      {voteItem?.conflictOfInterestExplanation}
                                    </span>
                                    <button
                                      onClick={() =>
                                        copyToClipboard(voteItem.conflictOfInterestExplanation!)
                                      }
                                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors print:hidden"
                                      title="העתק"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                            </div>
                            <div className="flex flex-col w-[160px] print:w-auto">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-900 dark:text-white text-sm font-medium">
                                  צד קשור:
                                </span>
                                <div
                                  className={`px-2 py-0.5 rounded text-sm font-medium ${getAgendaItemColor(voteItem?.isRelatedParty)}`}
                                >
                                  {voteItem?.isRelatedParty ? 'כן' : 'לא'}
                                </div>
                              </div>
                              {voteItem?.isRelatedParty && voteItem?.relatedPartyExplanation && (
                                <div className="flex items-start gap-1 mt-1">
                                  <span
                                    className="text-gray-700 dark:text-gray-300 text-sm flex-1"
                                    dir="rtl"
                                  >
                                    {voteItem?.relatedPartyExplanation}
                                  </span>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(voteItem.relatedPartyExplanation!)
                                    }
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors print:hidden"
                                    title="העתק"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col w-[160px] print:w-auto">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-900 dark:text-white text-sm font-medium">
                                  ועדת השקעות:
                                </span>
                                <div
                                  className={`px-2 py-0.5 rounded text-sm font-medium ${getAgendaItemColor(voteItem?.isInvestmentCommittee)}`}
                                >
                                  {voteItem?.isInvestmentCommittee ? 'כן' : 'לא'}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col w-[160px] print:w-auto">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-900 dark:text-white text-sm font-medium">
                                  עניין אישי:
                                </span>
                                <div
                                  className={`px-2 py-0.5 rounded text-sm font-medium ${getAgendaItemColor(voteItem?.hasPersonalInterest)}`}
                                >
                                  {voteItem?.hasPersonalInterest ? 'כן' : 'לא'}
                                </div>
                              </div>
                              {voteItem?.hasPersonalInterest &&
                                voteItem?.personalInterestExplanation && (
                                  <div className="flex items-start gap-1 mt-1">
                                    <span
                                      className="text-gray-700 dark:text-gray-300 text-sm flex-1"
                                      dir="rtl"
                                    >
                                      {voteItem?.personalInterestExplanation}
                                    </span>
                                    <button
                                      onClick={() =>
                                        copyToClipboard(voteItem.personalInterestExplanation!)
                                      }
                                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors print:hidden"
                                      title="העתק"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    {formData.displayVotingRecommendation && (
                      <TableCell className="text-right align-top">
                        {item.recommendation?.votingRecommendation ? (
                          <span className="inline-block bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900">
                            {item.recommendation.votingRecommendation}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">----</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right align-top">
                      <div
                        className={`px-2 py-0.5 rounded text-base font-medium inline-block ${getVoteResultColor(voteItem?.voteDecision || '')}`}
                      >
                        {voteItem?.voteDecision || '----'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top max-w-64">
                      <div
                        className="text-gray-900 dark:text-white text-base break-words"
                        dir={/[\u0590-\u05FF]/.test(voteItem?.voteReason || '') ? 'rtl' : 'ltr'}
                      >
                        {voteItem?.voteReason || '----'}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-base text-gray-900 dark:text-white">
            נספחים להצבעה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col border border-gray-100 dark:border-gray-800 dark:bg-gray-800/50 rounded p-2">
            <div className="text-gray-900 dark:text-white font-medium">הערות לקוח:</div>
            <div className="text-gray-900 dark:text-white">
              {formData.clientComment ? formData.clientComment : 'אין הערות'}
            </div>
          </div>
          {formData.voteDocuments && formData.voteDocuments.length > 0 ? (
            <div className="flex flex-col border border-gray-100 dark:border-gray-800 dark:bg-gray-800/50 rounded p-2">
              <div className="text-gray-900 dark:text-white font-medium">מסמכים:</div>
              <div className="space-y-1 mt-2">
                {formData.voteDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between bg-muted/30 dark:bg-gray-700/30 rounded-md px-3 py-1.5 text-sm"
                  >
                    <a
                      href={doc.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate max-w-[160px] hover:underline text-gray-900 dark:text-white"
                    >
                      {doc.filename}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-start pt-2">
        <Button
          onClick={handleSave}
          disabled={isLoading || !hasChanges || hasErrors}
          className="px-6"
        >
          {isLoading ? 'שומר...' : 'שמור'}
        </Button>
      </div>
    </div>
  ) : (
    <></>
  )
}
