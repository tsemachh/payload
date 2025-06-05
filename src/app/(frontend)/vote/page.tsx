'use client'

import { useEffect, useMemo, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ExternalLink, Upload } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

import { useSearchParams } from 'next/navigation'
import { MeetingTableDataType } from '../types/meetings'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import VoteDetails from './components/VoteDetails'
import VoteCompanySelector from './components/VoteCompanySelector'
import GeneralQuestions from './components/GeneralQuestions'
import AgendaQuestions from './components/AgendaQuestions'
import { AgendaQuestionsType, UserVote, VoteDataType } from '../types/vote'

export default function VotingForm() {
  const searchParams = useSearchParams()

  const [meetingData, setMeetingData] = useState<MeetingTableDataType | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [votingData, setVotingData] = useState<VoteDataType>({
    generalVotingData: {
      isInterested: false,
      isSeniorOfficial: false,
      isInstitutionalInvestor: true,
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
    explanation?: string,
  ) => {
    setVotingData((prev) => ({
      ...prev,
      generalVotingData: {
        ...prev.generalVotingData,
        [question]: value,
        ...(question === 'isInterested' && explanation !== undefined
          ? { interestedExplanation: explanation }
          : {}),
        ...(question === 'isSeniorOfficial' && explanation !== undefined
          ? { seniorOfficialExplanation: explanation }
          : {}),
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
                isInvestmentCommittee: true,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...filesArray])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return meetingData ? (
    <div className="w-full mx-auto py-6 px-4 sm:px-6 lg:px-8 rtl">
      {/* Header */}
      {meetingData.meetingInviteUrl ? (
        <div className="mb-3 mt-[-20px] text-center">
          <a
            href={meetingData.meetingInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center text-2xl font-bold text-blue-700 hover:text-blue-800 hover:underline transition-colors"
          >
            אסיפה {meetingData.meetingType} - {meetingData.stockName}
            <ExternalLink className="h-4 w-4 mr-2" />
          </a>
        </div>
      ) : (
        <div className="mb-3 mt-[-20px] text-center items-center justify-center text-2xl font-bold">
          אסיפה {meetingData.meetingType} - {meetingData.stockName}
        </div>
      )}

      {/* Main content */}
      <div className="space-y-6">
        <VoteDetails meetingData={meetingData} />
        <Card>
          <CardHeader className="bg-primary/10 py-1.5 px-3">
            <h2 className="text-sm font-medium text-primary">בחירת חברה</h2>
          </CardHeader>
          <CardContent className="p-4">
            <VoteCompanySelector
              meetingData={meetingData}
              meetingCompanies={meetingData.companies}
              onSelectionChangeAction={() => {}}
              //   onSelectionChangeAction={handleCompanySelection}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="bg-primary/10 py-1.5 px-3">
            <h2 className="text-sm font-medium text-primary">שאלות כלליות</h2>
          </CardHeader>
          <CardContent className="p-4">
            <GeneralQuestions
              generalVotingData={votingData.generalVotingData}
              onQuestionChangeAction={handleGeneralQuestionChange}
            />
          </CardContent>
        </Card>

        {/* Agenda */}
        <Card>
          <CardHeader className="bg-primary/10 py-1.5 px-3">
            <h2 className="text-sm font-medium text-primary">סדר יום</h2>
          </CardHeader>

          <CardContent className="p-4">
            <div className="space-y-6">
              {meetingData.agendas.map((item, index) => {
                const userVote = votingData.userVotes.find((v) => v.subjectId === item.id)
                const itemNumber = index + 1
                const isHebrew = /[\u0590-\u05FF]/.test(item.text)

                return (
                  <div key={item.id} className={`${item.isRemovedFromAgenda ? 'opacity-70' : ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-4 pl-3 pr-3">
                      <div>
                        <div className="flex items-start">
                          <span className="text-primary font-bold ml-2 mt-0.5 min-w-[24px]">
                            {itemNumber}.
                          </span>
                          <div className={`flex-1 ${isHebrew ? 'text-right' : 'text-left'}`}>
                            <p
                              className={`text-foreground font-medium ${
                                item.isRemovedFromAgenda ? 'line-through text-muted-foreground' : ''
                              }`}
                              dir={isHebrew ? 'rtl' : 'ltr'}
                            >
                              {item.text}
                            </p>
                          </div>
                        </div>

                        <div
                          className="flex flex-wrap gap-2 mt-2 mr-7"
                          style={{
                            justifyContent: isHebrew ? 'flex-start' : 'flex-end',
                          }}
                        >
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
                        <div className="flex flex-col items-center gap-2 min-w-[200px] border-r px-4  pl-0">
                          {item.recommendation.votingRecommendation && (
                            <span
                              className={`inline-block text-xs px-2 py-1 rounded-full border w-full text-center ${
                                item.recommendation.votingRecommendation === 'בעד'
                                  ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
                                  : item.recommendation.votingRecommendation === 'נגד'
                                    ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
                                    : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              המלצה: {item.recommendation.votingRecommendation}
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

                      {!item.isRemovedFromAgenda && (
                        <div className="border-r px-4 pl-0">
                          <AgendaQuestions
                            questions={
                              userVote?.questions || {
                                hasConflictOfInterest: false,
                                isRelatedParty: false,
                                isInvestmentCommittee: true,
                                hasPersonalInterest: false,
                              }
                            }
                            onChangeAction={(questions: AgendaQuestionsType) =>
                              handleAgendaQuestionsChange(item.id, questions)
                            }
                          />
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

        <Card>
          <CardHeader className="bg-primary/10 py-1.5 px-3">
            <h2 className="text-sm font-medium text-primary">נספחים להצבעה</h2>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-[3fr,1fr] gap-6">
              {/* הערות המצביע - חלק גדול */}
              <div>
                <div className="flex items-center mb-2">
                  <h3 className="text-xs font-medium text-muted-foreground">הערות המצביע</h3>
                </div>
                <Textarea
                  value={votingData.voterNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="הוסף הערות כאן..."
                  className="min-h-[150px] w-full border-muted bg-background resize-none focus-visible:ring-1"
                />
              </div>

              {/* העלאת קבצים - חלק קטן */}
              <div>
                <div className="flex items-center mb-2">
                  <h3 className="text-xs font-medium text-muted-foreground">העלאת קבצים</h3>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex items-center gap-2 bg-background border border-input rounded-md p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">בחר קובץ/קבצים</span>
                    </label>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-1.5 text-xs"
                        >
                          <span className="truncate max-w-[150px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-muted-foreground hover:text-destructive ml-2"
                          >
                            הסר
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* כפתור שליחת הצבעה */}
        <div className="flex justify-end mt-6">
          <Button className="px-8">שליחת הצבעה</Button>
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
