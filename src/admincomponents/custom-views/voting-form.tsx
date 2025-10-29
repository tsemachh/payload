'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckboxFilter } from '@/collections/votes/components/CheckboxFilter'
import { formatDateTime } from '@/app/(frontend)/helpers/utils-data-table'
import { formatNumberWithLocale } from '@/utils/numberUtils'
import { ReportApprovalUpload } from './uploadApproval'
import { OwnedQuantityInput } from './OwnedQuantityInput'

export interface VoteData {
  fundsData: Array<{
    company: { id: string; name: string }
    fund: { id: string; name: string }
    quantity: number
    ownedQuantity: number
    verifiedHoldings: boolean
    original?: {
      stockId: string
      quantity: number
      ownedQuantity: number
      verifiedHoldings: boolean
    }
  }>
  companies?: string[]
  id: string
  title: string
  company: string
  displayVotingRecommendation: boolean
  meeting: string
  meetingDate: string
  holdingsLimit: string
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
  votes: Array<{
    topicIndex: number
    voteDecision: string
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
  }>
}

interface VotingFormProps {
  voteData: VoteData
  meetingId: string
  companyIds: string
}

export function VotingForm({ voteData, meetingId, companyIds }: VotingFormProps) {
  const [formData, setFormData] = useState<VoteData>()
  const [initialFormData, setInitialFormData] = useState<VoteData>()
  const [hasChanges, setHasChanges] = useState(false)
  const [hasErrors, setHasErrors] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const router = useRouter()

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
    if (currentData.reported !== originalData.reported) return true

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
      companyIds: companyIds.split(','),
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

    if (field.startsWith('original.')) {
      // Handle nested original fields
      const originalField = field.replace('original.', '')
      const currentOriginal = updatedFunds[index].original || ({} as any)
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
    setFormData({ ...formData, fundsData: updatedFunds })
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
  const isOriginal = formData?.fundsData.some((fund) => fund.original)

  const saveDraftData = (label: string, updatedData: any) => {
    console.log(`Draft saved for ${label}`, updatedData)
    setFormData(updatedData)
  }

  return formData ? (
    <div
      className={`useTw ${isDarkMode ? 'dark' : ''} space-y-3 p-4 max-w-[80%] text-gray-900 dark:text-white`}
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
            <Checkbox
              checked={formData.reported}
              onCheckedChange={(checked) => setFormData({ ...formData, reported: !!checked })}
            />
            <label className="text-base font-medium text-gray-900 dark:text-white mr-3">
              הצבעה בפועל
            </label>
            <ReportApprovalUpload
              formData={formData}
              setFormData={setFormData}
              saveDraftData={saveDraftData}
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
                    נייר מקורי
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.fundsData.map((fund, index) => {
                const hasOriginal = fund.original
                const displayData = hasOriginal ? fund.original : fund
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
                        {fund.original?.stockId || ''}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="text-right text-gray-600 dark:text-gray-300 text-base">
                        {displayData?.quantity && formatNumberWithLocale(displayData.quantity)}
                      </span>
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
                      <OwnedQuantityInput
                        value={displayData?.ownedQuantity}
                        verifiedHoldings={displayData?.verifiedHoldings}
                        onChange={(value) =>
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
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4 pt-6 text-base">
            <div className="flex flex-col">
              <div className="flex items-center space-x-reverse space-x-2 justify-start">
                <label className="text-gray-900 dark:text-white font-medium ml-3">בעל עניין</label>
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
        </CardContent>
      </Card>
      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-base text-gray-900 dark:text-white">
            סדר יום להצבעה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(formData.agenda || []).map((item, index) => {
            const voteItem = voteData.votes[index]
            return (
              <div
                key={item.id}
                className="border border-gray-100 dark:border-gray-800 dark:bg-gray-800/50 rounded p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {index + 1}.
                  </span>
                  <div
                    className="flex-1 text-right text-base text-gray-900 dark:text-white mx-3 truncate min-w-0"
                    title={item.text}
                    dir={/[\u0590-\u05FF]/.test(item.text) ? 'rtl' : 'ltr'}
                  >
                    {item.text}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {formData.displayVotingRecommendation &&
                        item.recommendation?.votingRecommendation && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              המלצה:
                            </span>
                            <span className="inline-block bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900">
                              {item.recommendation.votingRecommendation}
                            </span>
                          </div>
                        )}
                      <div
                        className={`px-2 py-0.5 rounded text-base font-medium ${getVoteResultColor(voteData.votes[index].voteDecision)}`}
                      >
                        {voteItem.voteDecision || '----'}
                      </div>
                    </div>
                    {voteItem.voteReason && (
                      <span className="text-gray-700 dark:text-gray-300 text-sm mt-1" dir="rtl">
                        {voteItem.voteReason}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`flex justify-${item.majorityType === 'privileged' ? 'between' : 'end'} mt-2 w-full`}
                >
                  {item.majorityType === 'privileged' && (
                    <span className="inline-block bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900 h-fit">
                      דורש רוב מיוחד
                    </span>
                  )}
                  <div className="flex gap-4" dir="rtl">
                    <div className="flex flex-col">
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
                          <span className="text-gray-700 dark:text-gray-300 text-sm mt-1" dir="rtl">
                            {voteItem?.conflictOfInterestExplanation}
                          </span>
                        )}
                    </div>
                    <div className="flex flex-col">
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
                        <span className="text-gray-700 dark:text-gray-300 text-sm mt-1" dir="rtl">
                          {voteItem?.relatedPartyExplanation}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col">
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
                    <div className="flex flex-col">
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
                      {voteItem?.hasPersonalInterest && voteItem?.personalInterestExplanation && (
                        <span className="text-gray-700 dark:text-gray-300 text-sm mt-1" dir="rtl">
                          {voteItem?.personalInterestExplanation}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
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
                      className="truncate max-w-[150px] hover:underline text-gray-900 dark:text-white"
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
