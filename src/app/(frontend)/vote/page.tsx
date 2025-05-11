'use client'

import { useEffect, useState } from 'react'
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
import {
  AgendaQuestionsType,
  MeetingTableDataType,
  UserVote,
  VoteDataType,
} from '../types/meetings'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import VoteDetails from './components/VoteDetails'
import VoteCompanySelector from './components/VoteCompanySelector'
import GeneralQuestions from './components/GeneralQuestions'
import AgendaQuestions from './components/AgendaQuestions'

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

  const handleAgendaQuestionsChange = (subjectId: string, questions: AgendaQuestionsType) => {
    setVotingData((prev) => {
      const existingVoteIndex = prev.userVotes.findIndex((vote) => vote.subjectId === subjectId)
      if (existingVoteIndex !== -1) {
        return {
          ...prev,
          userVotes: prev.userVotes.map((vote) =>
            vote.subjectId === subjectId ? { ...vote, questions } : vote,
          ),
        }
      } else {
        return {
          ...prev,
          userVotes: [...prev.userVotes, { subjectId, choice: null, questions }],
        }
      }
    })
  }

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
    setVotingData((prev) => {
      const existingVoteIndex = prev.userVotes.findIndex((vote) => vote.subjectId === subjectId)
      if (existingVoteIndex !== -1) {
        return {
          ...prev,
          userVotes: prev.userVotes.map((vote) =>
            vote.subjectId === subjectId ? { ...vote, choice } : vote,
          ),
        }
      } else {
        return {
          ...prev,
          userVotes: [
            ...prev.userVotes,
            {
              subjectId,
              choice,
              questions: {
                hasConflictOfInterest: false,
                isRelatedParty: false,
                isInvestmentCommittee: false,
                hasPersonalInterest: false,
              },
            },
          ],
        }
      }
    })
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
      <div className="mb-3 mt-[-20px] text-center">
        <a
          href={`https://www.tase.co.il/he/market_data/security/${meetingData.stockNumber}/major_data`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center text-2xl font-bold text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          אסיפה {meetingData.meetingType} - {meetingData.stockName}
          <ExternalLink className="h-4 w-4 mr-2" />
        </a>
      </div>

      {/* Main content */}
      <div className="space-y-6">
        <VoteDetails meetingData={meetingData} />

        <VoteCompanySelector
          companies={meetingData.companies}
          onSelectionChange={() => {}}
          //   onSelectionChange={handleCompanySelection}
        />

        <GeneralQuestions
          generalVotingData={votingData.generalVotingData}
          onQuestionChange={handleGeneralQuestionChange}
        />

        {/* Agenda */}
        <Card>
          <CardHeader className="bg-primary/10 py-1.5 px-3">
            <h2 className="text-sm font-medium text-primary">סדר יום</h2>
          </CardHeader>

          <CardContent className="p-4">
            <div className="space-y-6">
              {meetingData.agendas.map((item) => {
                const userVote = votingData.userVotes.find((v) => v.subjectId === item.id)

                return (
                  <div key={item.id} className={`${item.isRemovedFromAgenda ? 'opacity-70' : ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-4 pl-3 pr-3">
                      <div>
                        <p
                          className={`text-foreground font-medium ${
                            item.isRemovedFromAgenda ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {item.text}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-2">
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
                        <AgendaQuestions
                          questions={
                            userVote?.questions || {
                              hasConflictOfInterest: false,
                              isRelatedParty: false,
                              isInvestmentCommittee: false,
                              hasPersonalInterest: false,
                            }
                          }
                          onChange={(questions: AgendaQuestionsType) =>
                            handleAgendaQuestionsChange(item.id, questions)
                          }
                        />
                      )}

                      {!item.isRemovedFromAgenda && (
                        <div className="flex flex-col items-center gap-2 min-w-[200px]">
                          {item.recommendation && (
                            <span
                              className={`inline-block text-xs px-2 py-1 rounded-full border w-full text-center ${
                                item.recommendation === 'בעד'
                                  ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
                                  : item.recommendation === 'נגד'
                                    ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
                                    : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              המלצה: {item.recommendation}
                            </span>
                          )}
                          <Select
                            value={userVote?.choice || undefined}
                            onValueChange={(value) =>
                              handleVoteChange(item.id, value as UserVote['choice'])
                            }
                          >
                            <SelectTrigger
                              className={`w-full ${
                                userVote?.choice === 'בעד'
                                  ? 'border-green-500 bg-green-100 dark:bg-green-950 dark:border-green-800'
                                  : userVote?.choice === 'נגד'
                                    ? 'border-red-500 bg-red-100 dark:bg-red-950 dark:border-red-800'
                                    : userVote?.choice === 'נמנע'
                                      ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-950 dark:border-yellow-800'
                                      : 'border-input'
                              }`}
                            >
                              <SelectValue placeholder="בחר הצבעה" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="----">----</SelectItem>
                              <SelectItem
                                value="בעד"
                                className="text-green-700 dark:text-green-400"
                              >
                                בעד
                              </SelectItem>
                              <SelectItem value="נגד" className="text-red-700 dark:text-red-400">
                                נגד
                              </SelectItem>
                              <SelectItem
                                value="נמנע"
                                className="text-yellow-700 dark:text-yellow-400"
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
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center mb-3">
              <h3 className="text-xs font-medium text-muted-foreground">הערות המצביע</h3>
            </div>
            <Textarea
              value={votingData.voterNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="הוסף הערות כאן..."
              className="min-h-[150px] w-full border-muted bg-background resize-none focus-visible:ring-1"
            />
          </div>

          <div className="border border-border rounded-lg p-4 bg-card flex flex-col">
            <div className="flex items-center mb-3">
              <h3 className="text-xs font-medium text-muted-foreground">פעולות</h3>
            </div>

            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-2">העלאת קבצים</div>
              <div className="flex items-center gap-2 bg-background border border-input rounded-md p-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <Input type="file" className="flex-1 border-0 bg-transparent focus-visible:ring-0 p-0" />
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <Button
                onClick={handlePrintVote}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 bg-background"
              >
                <Printer className="h-4 w-4" />
                הדפסת הצבעה
              </Button>

              <Button className="w-full">שליחת הצבעה</Button>
            </div>
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
