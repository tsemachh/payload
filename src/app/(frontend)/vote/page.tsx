'use client'

import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ExternalLink, Printer, Upload } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

import { useSearchParams } from 'next/navigation'
import { formatDateTime } from '../helpers/utils-data-table'
import { MeetingTableDataType, UserVote, VoteDataType } from '../types/meetings'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'

export default function VotingForm() {
  const searchParams = useSearchParams()
  const [meetingData, setMeetingData] = useState<MeetingTableDataType | null>(null)
  const [votingData, setVotingData] = useState<VoteDataType>({
    generalVotingData: {
      isInterested: false,
      isSeniorOfficial: false,
      isInstitutionalInvestor: false,
    },
    voterNotes: '',
    userVotes: [],
  })

  useEffect(() => {
    const encoded = searchParams.get('data')
    if (encoded) {
      try {
        const decoded = decodeURIComponent(encoded)
        const json = JSON.parse(decodeURIComponent(escape(atob(decoded))))
        setMeetingData(json.meeting)
      } catch (error) {
        console.error('שגיאה בדיקוד הנתונים', error)
      }
    }
  }, [searchParams])

  //   const handleCompanySelection = (companyId: string, selected: boolean) => {
  //     setVotingData((prev) => ({
  //       ...prev,
  //       holdingCompanies: prev.holdingCompanies.map((company) =>
  //         company.id === companyId ? { ...company, selected } : company,
  //       ),
  //     }))
  //   }

  const handleGeneralQuestionChange = (
    question: 'isInterested' | 'isSeniorOfficial' | 'isInstitutionalInvestor',
    value: boolean,
  ) => {
    setVotingData((prev) => ({
      ...prev,
      generalVotingData: {
        ...prev.generalVotingData,
        [question]: value,
      },
    }))
  }

  const handleVoteChange = (subjectId: string, choice: UserVote['choice']) => {
    setVotingData((prev) => ({
      ...prev,
      userVotes: prev.userVotes.map((vote) =>
        vote.subjectId === subjectId ? { ...vote, choice } : vote,
      ),
    }))
  }

  const handleNotesChange = (notes: string) => {
    setVotingData((prev) => ({
      ...prev,
      voterNotes: notes,
    }))
  }

  const handlePrintVote = () => {
    window.print()
  }

  return meetingData ? (
    <div className="w-full mx-auto py-6 px-4 sm:px-6 lg:px-8 rtl">
      {/* Header */}
      <div className=" mb-3  mt-[-20px] text-center">
        <p className="text-2xl font-bold text-foreground">
          אסיפה {meetingData.meetingType} - {meetingData.stockName}
        </p>
      </div>

      {/* Main content */}
      <div className="space-y-6">
        {/* Main Sections - All in one row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Security and Assembly Details */}
          <Card>
            <CardContent className="p-3 text-sm">
              {/* פרטי האסיפה */}
              <div className="mb-4">
                <div className="flex items-center mb-2">
                  <h3 className="text-xs font-semibold text-primary whitespace-nowrap">
                    פרטי האסיפה
                  </h3>
                  <div className="flex-1 border-t border-primary/30 mr-2 mt-0.5"></div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">תאריך האסיפה</span>
                    <span className="text-foreground">
                      {formatDateTime(meetingData.meetingDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">מיקום האסיפה</span>
                    <span className="text-foreground">{}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">מועד קובע</span>
                    <span className="text-foreground">
                      {formatDateTime(meetingData.holdingsLimit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">מועד מסירת ההצבעות</span>
                    <span className="text-foreground">
                      {formatDateTime(meetingData.proxyVotingDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">קישור לזימון האסיפה</span>
                    <a
                      href={'https://example.com/meeting-invitation'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 hover:underline text-xs flex items-center transition-colors"
                    >
                      צפייה בזימון <ExternalLink className="h-3 w-3 mr-1" />
                    </a>
                  </div>
                </div>
              </div>

              {/* פרטי נייר ערך */}
              <div>
                <div className="flex items-center mb-2">
                  <h3 className="text-xs font-semibold text-primary whitespace-nowrap">
                    פרטי נייר ערך
                  </h3>
                  <div className="flex-1 border-t border-primary/30 mr-2 mt-0.5"></div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">שם חברה</span>
                    <span className="text-foreground">{meetingData.companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">סוג נייר</span>
                    <span className="text-foreground">{meetingData.stockType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">שווי שוק</span>
                    <span className="text-foreground">{meetingData.marketValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">קישור לנייר בבורסה</span>
                    <a
                      href={'https://example.com/stock-exchange'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 hover:underline text-xs flex items-center transition-colors"
                    >
                      צפייה בנייר <ExternalLink className="h-3 w-3 mr-1" />
                    </a>
                  </div>
                </div>
              </div>

              {/* הערות האסיפה */}
              {meetingData.comments && meetingData.comments != '-' && (
                <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded p-2 text-xs dark:bg-yellow-950 dark:border-yellow-900 dark:text-yellow-200">
                  <p className="text-foreground/80">{meetingData.comments}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Company Selection - Compact */}
          <Card>
            <CardContent className="p-3">
              <div className="overflow-auto max-h-[250px] border rounded-md">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th
                        scope="col"
                        className="px-2 py-2 text-right text-xs font-medium text-muted-foreground"
                      >
                        בחירה
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 text-right text-xs font-medium text-muted-foreground"
                      >
                        שם החברה
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 text-right text-xs font-medium text-muted-foreground"
                      >
                        ערך רשום
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {/* {votingData.holdingCompanies.map((company) => (
                      <tr key={company.id} className="hover:bg-muted">
                        <td className="px-2 py-2 whitespace-nowrap">
                          <Checkbox
                            id={`company-${company.id}`}
                            checked={company.selected}
                            onCheckedChange={(checked) =>
                              handleCompanySelection(company.id, checked as boolean)
                            }
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs">{company.name}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs">
                          {company.registeredValue.toLocaleString()} ₪
                        </td>
                      </tr>
                    ))} */}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* General Questions - Redesigned */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-foreground text-sm font-medium">האם הינך בעל עניין?</p>
                    <div className="flex bg-muted rounded-full p-0.5">
                      <button
                        type="button"
                        onClick={() => handleGeneralQuestionChange('isInterested', true)}
                        className={`px-3 py-1 text-xs rounded-full transition-all ${
                          votingData?.generalVotingData.isInterested === true
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted-foreground/10'
                        }`}
                      >
                        כן
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGeneralQuestionChange('isInterested', false)}
                        className={`px-3 py-1 text-xs rounded-full transition-all ${
                          votingData?.generalVotingData.isInterested === false
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted-foreground/10'
                        }`}
                      >
                        לא
                      </button>
                    </div>
                  </div>
                  <Separator className="my-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-foreground text-sm font-medium">האם הינך נושא משרה בכירה?</p>
                    <div className="flex bg-muted rounded-full p-0.5">
                      <button
                        type="button"
                        onClick={() => handleGeneralQuestionChange('isSeniorOfficial', true)}
                        className={`px-3 py-1 text-xs rounded-full transition-all ${
                          votingData?.generalVotingData.isSeniorOfficial === true
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted-foreground/10'
                        }`}
                      >
                        כן
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGeneralQuestionChange('isSeniorOfficial', false)}
                        className={`px-3 py-1 text-xs rounded-full transition-all ${
                          votingData?.generalVotingData.isSeniorOfficial === false
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted-foreground/10'
                        }`}
                      >
                        לא
                      </button>
                    </div>
                  </div>
                  <Separator className="my-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-foreground text-sm font-medium">האם הינך משקיע מוסדי?</p>
                    <div className="flex bg-muted rounded-full p-0.5">
                      <button
                        type="button"
                        onClick={() => handleGeneralQuestionChange('isInstitutionalInvestor', true)}
                        className={`px-3 py-1 text-xs rounded-full transition-all ${
                          votingData?.generalVotingData.isInstitutionalInvestor === true
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted-foreground/10'
                        }`}
                      >
                        כן
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleGeneralQuestionChange('isInstitutionalInvestor', false)
                        }
                        className={`px-3 py-1 text-xs rounded-full transition-all ${
                          votingData?.generalVotingData.isInstitutionalInvestor === false
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted-foreground/10'
                        }`}
                      >
                        לא
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>{' '}
          </Card>
        </div>

        {/* Agenda */}
        <Card>
          <CardHeader className="bg-primary/10 py-3 px-4">
            <h2 className="text-lg font-medium text-primary">סדר יום</h2>
          </CardHeader>

          <CardContent className="p-4">
            <div className="space-y-6">
              {meetingData.agendas.map((item) => (
                <div key={item.id} className={`${item.isRemovedFromAgenda ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p
                        className={`text-foreground font-medium ${item.isRemovedFromAgenda ? 'line-through text-muted-foreground' : ''}`}
                      >
                        {item.text}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.recommendation && !item.isRemovedFromAgenda && (
                          <span
                            className={`inline-block text-xs px-2 py-1 rounded-full border ${
                              item.recommendation === 'בעד'
                                ? ' bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
                                : item.recommendation === 'נגד'
                                  ? 'bg-red-100 text-red-800 border-red-200  dark:bg-red-950 dark:text-red-200 dark:border-red-900'
                                  : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            המלצה: {item.recommendation}
                          </span>
                        )}
                        {item.privilegedMajority && !item.isRemovedFromAgenda && (
                          <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900">
                            דורש רוב מיוחד
                          </span>
                        )}
                        {item.isRemovedFromAgenda && (
                          <span className="inline-block bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full border border-border">
                            הוסר מסדר היום
                          </span>
                        )}
                      </div>
                    </div>

                    {!item.isRemovedFromAgenda && (
                      <div className="w-40 flex-shrink-0">
                        <Select
                          value={undefined}
                          onValueChange={(value) =>
                            handleVoteChange(item.id, value as UserVote['choice'])
                          }
                        >
                          <SelectTrigger
                            className={`w-full ${
                              votingData.userVotes.find((v) => v.subjectId === item.id)?.choice ===
                              'בעד'
                                ? 'border-green-500 bg-green-100 dark:bg-green-950 dark:border-green-800'
                                : votingData.userVotes.find((v) => v.subjectId === item.id)
                                      ?.choice === 'נגד'
                                  ? 'border-red-500 bg-red-100 dark:bg-red-950 dark:border-red-800'
                                  : votingData.userVotes.find((v) => v.subjectId === item.id)
                                        ?.choice === 'נמנע'
                                    ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-950 dark:border-yellow-800'
                                    : 'border-input'
                            }`}
                          >
                            <SelectValue placeholder="בחר הצבעה" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="----">----</SelectItem>
                            <SelectItem value="בעד" className="text-green-700  dark:text-green-400">
                              בעד
                            </SelectItem>
                            <SelectItem value="נגד" className="text-red-700  dark:text-red-400">
                              נגד
                            </SelectItem>
                            <SelectItem
                              value="נמנע"
                              className="text-yellow-700  dark:text-yellow-400"
                            >
                              נמנע
                            </SelectItem>
                            <SelectItem value="אין חובת השתתפות">אין חובת השתתפות</SelectItem>
                            <SelectItem value="לא משתתף">לא משתתף</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {!item.isRemovedFromAgenda &&
                    item.id !== meetingData.agendas[meetingData.agendas.length - 1].id && (
                      <div className="mt-4 mb-2 border-b border-border" />
                    )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Voter Notes */}
        <Card>
          <CardHeader className="bg-primary/10 py-3 px-4">
            <h2 className="text-lg font-medium text-primary">הערות המצביע</h2>
          </CardHeader>
          <CardContent className="p-4">
            <Textarea
              value={votingData.voterNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="הזן הערות כאן..."
              className="min-h-[100px] w-full"
            />
          </CardContent>
        </Card>
        <Separator className="my-6" />

        {/* Actions */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <Button onClick={handlePrintVote} variant="outline" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            הדפסת הצבעה
          </Button>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="text-sm">העלאת קבצים:</span>
              <Input type="file" className="max-w-xs" />
            </div>

            <Button>שליחת הצבעה</Button>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinnerDiamond />
      </div>
    </div>
  )
}
