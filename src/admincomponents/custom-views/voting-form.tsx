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
  meeting: string
  isInterested: boolean
  isSeniorOfficial: boolean
  isInstitutionalInvestor: boolean
  voteAgainstRecommendation: boolean
  voteDifferentFromResult: boolean
  reported: boolean
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
    const updatedFunds = [...formData.fundsData]
    updatedFunds[index] = { ...updatedFunds[index], [field]: value }
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

  return formData ? (
    <div className="useTw space-y-3 p-4 max-w-[80%]" dir="rtl">
      <Card className="border border-gray-200">
        <CardHeader className="pb-6">
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
                    <span className="text-right text-gray-600 text-base">{fund.quantity}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant={fund.verifiedHoldings ? 'default' : 'outline'}
                        size="sm"
                        className={`${
                          fund.verifiedHoldings
                            ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                            : 'border-green-600 text-green-600 hover:bg-green-50'
                        }`}
                        onClick={() => {
                          updateFundData(index, 'verifiedHoldings', true)
                        }}
                      >
                        כן
                      </Button>
                      <Button
                        variant={!fund.verifiedHoldings ? 'default' : 'outline'}
                        size="sm"
                        className={`${
                          !fund.verifiedHoldings
                            ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                            : 'border-red-600 text-red-600 hover:bg-red-50'
                        }`}
                        onClick={() => {
                          updateFundData(index, 'verifiedHoldings', false)
                        }}
                      >
                        לא
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={fund.ownedQuantity}
                      onChange={(e) => updateFundData(index, 'ownedQuantity', e.target.value)}
                      className="text-right h-8 text-base border-gray-300 max-w-[100px]"
                      disabled={fund.verifiedHoldings === null}
                      style={{
                        visibility: fund.verifiedHoldings ? 'hidden' : 'visible',
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
            <div className="flex items-center space-x-reverse space-x-2 justify-start">
              <label className="text-gray-900 ml-3">מעוניין</label>
              <Checkbox checked={formData.isInterested} disabled={true} />
            </div>
            <div className="flex items-center space-x-reverse space-x-2 justify-start">
              <label className="text-gray-900 ml-3">בעל תפקיד בכיר</label>
              <Checkbox checked={formData.isSeniorOfficial} disabled={true} />
            </div>
            <div className="flex items-center space-x-reverse space-x-2 justify-start">
              <label className="text-gray-900 ml-3">משקיע מוסדי</label>
              <Checkbox checked={formData.isInstitutionalInvestor} disabled={true} />
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
                  >
                    {item.text}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                      className={`px-2 py-0.5 rounded text-base font-medium ${getVoteResultColor(voteData.votes[index].voteDecision || '----')}`}
                    >
                      {voteData.votes[index].voteDecision || '----'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-start gap-4 text-xs mt-2" dir="rtl">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700">דורש רוב מיוחד:</span>
                    <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          item.majorityType === 'privileged'
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        כן
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          item.majorityType !== 'privileged'
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        לא
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-gray-700">ניגוד עניינים:</span>
                    <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          voteItem?.hasConflictOfInterest
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        כן
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          !voteItem?.hasConflictOfInterest
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        לא
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-gray-700">צד קשור:</span>
                    <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          voteItem?.isRelatedParty
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        כן
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          !voteItem?.isRelatedParty
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        לא
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-gray-700">ועדת השקעות:</span>
                    <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          voteItem?.isInvestmentCommittee
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        כן
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          !voteItem?.isInvestmentCommittee
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        לא
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-gray-700">עניין אישי:</span>
                    <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          voteItem?.hasPersonalInterest
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        כן
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-3 text-xs rounded-sm transition-all ${
                          !voteItem?.hasPersonalInterest
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled
                      >
                        לא
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
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
