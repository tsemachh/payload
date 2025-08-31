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
import { formatDateTime } from '../../app/(frontend)/helpers/utils-data-table'

interface VoteData {
  fundsData: Array<{
    company: { id: string; name: string }
    fund: { id: string; name: string }
    quantity: number
    ownedQuantity: number
    verifiedHoldings: boolean
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
  clientComment?: string
  votes: Array<{
    topicIndex: number
    voteDecision: string
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
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!voteData) return
    console.log('!!voteData', voteData)
    setFormData(voteData)
  }, [voteData])

  const handleSave = async () => {
    const fundsWithHolding = formData?.fundsData.map((fund) => {
      return {
        company: fund.company.id,
        fund: fund.fund.id,
        ownedQuantity: fund.ownedQuantity,
        verifiedHoldings: fund.verifiedHoldings,
      }
    })
    const reqBody = {
      meetingId,
      companyIds: companyIds.split(','),
      votesData: { reported: formData?.reported, fundsWithHolding },
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
    updatedFunds[index] = { ...updatedFunds[index], [field]: booleanValue }
    setFormData({ ...formData, fundsData: updatedFunds })
  }

  const getVoteResultColor = (result: string) => {
    switch (result) {
      case 'בעד':
        return 'text-green-700 bg-green-100 border-green-200'
      case 'נגד':
        return 'text-red-700 bg-red-100 border-red-200'
      case 'נמנע':
        return 'text-blue-700 bg-blue-100 border-blue-200'
      default:
        return 'text-gray-700 bg-gray-100 border-gray-200'
    }
  }

  const getAgendaItemColor = (result: boolean) => {
    if (result === true) {
      return 'text-green-700 bg-green-100 border-green-200'
    } else if (result === false) {
      return 'text-red-700 bg-red-100 border-red-200'
    } else {
      return 'text-gray-700 bg-gray-100 border-gray-200'
    }
  }

  return formData ? (
    <div className="useTw space-y-3 p-4 max-w-[80%]" dir="rtl">
      <Card className="border border-gray-200">
        <CardHeader className="pb-6">
          <CardTitle className="text-center text-xl font-bold text-gray-900">
            {voteData.meeting}
          </CardTitle>
          <div className="flex items-center text-base text-gray-700 gap-12 justify-center pt-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">תאריך האסיפה:</span>
              <span>{formatDateTime(formData.meetingDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">מועד קובע:</span>
              <span>{formatDateTime(formData.holdingsLimit)}</span>
            </div>
          </div>
          <CardTitle className="text-right text-base text-gray-900">חברות </CardTitle>
          <div className="flex flex-wrap gap-2 text-right">
            {formData.companies?.map((company, index) => (
              <div key={index} className="bg-muted rounded-full px-4 py-1 flex items-center">
                <span className="text-base font-medium text-gray-900">{company}</span>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      <Card className="border border-gray-200">
        <CardContent>
          <div className="flex items-center justify-start space-x-reverse space-x-2 pt-6 pb-4">
            <Checkbox
              checked={formData.reported}
              onCheckedChange={(checked) => setFormData({ ...formData, reported: !!checked })}
            />
            <label className="text-base font-medium text-gray-900 mr-3">הצבעה בפועל</label>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="text-base">
                <TableHead className="text-right w-64 text-gray-900">חברה</TableHead>
                <TableHead className="text-right w-64 text-gray-900">שם תיק</TableHead>
                <TableHead className="text-right w-32 text-gray-900">ערך נקוב במערכת</TableHead>
                <TableHead className="text-right w-24 text-gray-900">אימות אחזקות</TableHead>
                <TableHead className="text-right w-32 text-gray-900">ערך נקוב ברשות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.fundsData.map((fund, index) => (
                <TableRow key={index} className="text-base border-b border-gray-100">
                  <TableCell className="text-right font-medium text-base text-gray-900">
                    {fund.company.name}
                  </TableCell>
                  <TableCell className="text-right text-base text-gray-900">
                    {fund.fund.name}
                  </TableCell>
                  <TableCell>
                    <span className="text-right text-gray-600 text-base">
                      {new Intl.NumberFormat('he-IL', {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      }).format(fund.quantity)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <CheckboxFilter
                        value={
                          fund.verifiedHoldings === false
                            ? 'unchecked'
                            : fund.verifiedHoldings === true
                              ? 'checked'
                              : 'indeterminate'
                        }
                        onChangeAction={(state) => updateFundData(index, 'verifiedHoldings', state)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={new Intl.NumberFormat('he-IL', {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      }).format(fund.ownedQuantity)}
                      onChange={(e) => updateFundData(index, 'ownedQuantity', e.target.value)}
                      className="text-right h-8 text-base border-gray-300 max-w-[100px]"
                      style={{
                        visibility:
                          fund.verifiedHoldings || fund.verifiedHoldings === undefined
                            ? 'hidden'
                            : 'visible',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="border border-gray-200">
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4 pt-6 text-base">
            <div className="flex flex-col">
              <div className="flex items-center space-x-reverse space-x-2 justify-start">
                <label className="text-gray-900 font-medium ml-3">בעל עניין</label>
                <Checkbox checked={formData.isInterested} disabled={true} />
              </div>
              {formData.isInterested && formData.interestedExplanation && (
                <span className="text-gray-700 text-sm mt-1" dir="rtl">
                  {formData.interestedExplanation}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-reverse space-x-2 justify-start">
                <label className="text-gray-900 font-medium ml-3">נושא משרה בכירה</label>
                <Checkbox checked={formData.isSeniorOfficial} disabled={true} />
              </div>
              {formData.isSeniorOfficial && formData.seniorOfficialExplanation && (
                <span className="text-gray-700 text-sm mt-1" dir="rtl">
                  {formData.seniorOfficialExplanation}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-reverse space-x-2 justify-start">
                <label className="text-gray-900 font-medium ml-3">משקיע מוסדי</label>
                <Checkbox checked={formData.isInstitutionalInvestor} disabled={true} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-base text-gray-900">סדר יום להצבעה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(formData.agenda || []).map((item, index) => {
            const voteItem = voteData.votes[index]
            return (
              <div key={item.id} className="border border-gray-100 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-blue-600">{index + 1}.</span>
                  <div
                    className="flex-1 text-right text-base text-gray-900 mx-3 truncate min-w-0"
                    title={item.text}
                    dir={/[\u0590-\u05FF]/.test(item.text) ? 'rtl' : 'ltr'}
                  >
                    {item.text}
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0">
                    {formData.displayVotingRecommendation &&
                      item.recommendation?.votingRecommendation && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">המלצה:</span>
                          <span className="inline-block bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900">
                            {item.recommendation.votingRecommendation}{' '}
                          </span>
                        </div>
                      )}
                    <div
                      className={`px-2 py-0.5 rounded text-base font-medium ${getVoteResultColor(voteData.votes[index].voteDecision)}`}
                    >
                      {voteData.votes[index].voteDecision || '----'}
                    </div>
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
                        <span className="text-gray-900 text-sm font-medium">ניגוד עניינים:</span>
                        <div
                          className={`px-2 py-0.5 rounded text-sm font-medium ${getAgendaItemColor(voteItem?.hasConflictOfInterest)}`}
                        >
                          {voteItem?.hasConflictOfInterest ? 'כן' : 'לא'}
                        </div>
                      </div>
                      {voteItem?.hasConflictOfInterest &&
                        voteItem?.conflictOfInterestExplanation && (
                          <span className="text-gray-700 text-sm mt-1" dir="rtl">
                            {voteItem?.conflictOfInterestExplanation}
                          </span>
                        )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-900 text-sm font-medium">צד קשור:</span>
                        <div
                          className={`px-2 py-0.5 rounded text-sm font-medium ${getAgendaItemColor(voteItem?.isRelatedParty)}`}
                        >
                          {voteItem?.isRelatedParty ? 'כן' : 'לא'}
                        </div>
                      </div>
                      {voteItem?.isRelatedParty && voteItem?.relatedPartyExplanation && (
                        <span className="text-gray-700 text-sm mt-1" dir="rtl">
                          {voteItem?.relatedPartyExplanation}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-900 text-sm font-medium">ועדת השקעות:</span>
                        <div
                          className={`px-2 py-0.5 rounded text-sm font-medium ${getAgendaItemColor(voteItem?.isInvestmentCommittee)}`}
                        >
                          {voteItem?.isInvestmentCommittee ? 'כן' : 'לא'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-900 text-sm font-medium">עניין אישי:</span>
                        <div
                          className={`px-2 py-0.5 rounded text-sm font-medium ${getAgendaItemColor(voteItem?.hasPersonalInterest)}`}
                        >
                          {voteItem?.hasPersonalInterest ? 'כן' : 'לא'}
                        </div>
                      </div>
                      {voteItem?.hasPersonalInterest && voteItem?.personalInterestExplanation && (
                        <span className="text-gray-700 text-sm mt-1" dir="rtl">
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
      <Card className="border border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-base text-gray-900">נספחים להצבעה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col border border-gray-100 rounded p-2">
            <div className="text-gray-900 font-medium">הערות ללקוח:</div>
            <div>{formData.clientComment ? formData.clientComment : 'אין הערות'}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start pt-2">
        <Button onClick={handleSave} disabled={isLoading} className="px-6">
          {isLoading ? 'שומר...' : 'שמור'}
        </Button>
      </div>
    </div>
  ) : (
    <></>
  )
}
