'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { CompanyTableDate, MeetingTableDataType } from '../types/meetings'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'
import VoteDetails from './components/VoteDetails'
import VoteCompanySelector from './components/VoteCompanySelector'
import GeneralQuestions from './components/GeneralQuestions'
import AgendaQuestions from './components/AgendaQuestions'
import {
  AgendaQuestionId,
  AgendaQuestionsType,
  AgendaVotingIDs,
  GeneralQuestionId,
  GeneralVotingData,
  GeneralVotingIDs,
  UserVote,
  VoteDataType,
} from '../types/vote'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  AGENDA_QUESTIONS_CONFIG,
  GENERAL_QUESTIONS_CONFIG,
  getExplanationFieldName,
} from './questionConsts'
import { createDefaultAgendaQuestions, fetcherVote } from '../helpers/utils-vote'
import useSWR from 'swr'

export default function VotingForm() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [meetingData, setMeetingData] = useState<MeetingTableDataType | null>(null)
  const [companiesIDs, setCompaniesIDs] = useState<string>('')
  const [meetingIdPayload, setMeetingIdPayload] = useState<string>('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [debounceTimers, setDebounceTimers] = useState<Record<string, NodeJS.Timeout>>({})

  // שינוי כאן: נאתחל את votingData עם ערכים ריקים, כי השרת יספק את הנתונים
  const [votingData, setVotingData] = useState<VoteDataType>({
    generalVotingData: {
      isInterested: null,
      isSeniorOfficial: null,
      isInstitutionalInvestor: null,
    },
    voterNotes: '',
    userVotes: [],
  })

  useEffect(() => {
    const meetingIdFromUrl = searchParams.get('meetingId')
    if (meetingIdFromUrl) {
      const fetchMeetingDetails = async () => {
        try {
          const response = await fetch(`/api/meetings/by-id?meetingId=${meetingIdFromUrl}`)
          if (!response.ok) {
            throw new Error('Failed to fetch meeting data')
          }
          const data = await response.json()
          setMeetingData(data.data[0])
        } catch (error) {
          console.error('Error fetching meeting data:', error)
          toast({
            title: '⚠️ שגיאה',
            description: 'שגיאה בטעינת נתוני האסיפה.',
            variant: 'destructive',
            duration: 5000,
          })
        }
      }
      fetchMeetingDetails()
    } else {
      console.warn('No meetingId found in URL. Cannot load meeting data.')
      toast({
          title: '⚠️ שגיאה',
          description: 'לא נמצא מזהה אסיפה בכתובת.',
          variant: 'destructive',
          duration: 5000,
      });
    }
  }, [searchParams, toast]) 

  useEffect(() => {
    if (meetingData) {
      const companyIDsTmp =
        meetingData?.companies.map((comp: CompanyTableDate) => comp.id).join(',') || ''
      setCompaniesIDs(companyIDsTmp)
      const meetingIdPayloadTmp = meetingData?.meetingIdPayload || ''
      setMeetingIdPayload(meetingIdPayloadTmp)
    }
  }, [meetingData])

  const swrKey =
    meetingIdPayload && companiesIDs
      ? `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companyIds=${companiesIDs}`
      : null

  const {
    data: fetchedVotes,
    error,
    isLoading: isSWRLoading,
  } = useSWR(swrKey, fetcherVote, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (isSWRLoading) {
      return
    }
    if (error) {
      console.error('Error fetching vote data with SWR:', error)
      toast({
        title: '⚠️ שגיאה בטעינה',
        description: error.message || 'לא ניתן לטעון נתוני הצבעה קיימים.',
        variant: 'destructive',
        duration: 5000,
      })
      if (!meetingData) return

      // אם יש שגיאה או לא חזרו נתונים, אתחל לערכי ברירת מחדל מלאים
      setVotingData({
        generalVotingData: {
          isInterested: false,
          isSeniorOfficial: false,
          isInstitutionalInvestor: true,
          interestedExplanation: undefined,
          seniorOfficialExplanation: undefined,
        },
        voterNotes: '',
        userVotes: createDefaultAgendaQuestions(meetingData.agendas),
      })
      return
    }

    if (meetingData && fetchedVotes) {
      // יש נתונים, נשתמש באיבר הראשון כפי שביקשת
      const firstVote = fetchedVotes[0]

      if (firstVote) {
        const transformedUserVotes = meetingData.agendas.map((agenda) => {
          // מצא את ההצבעה הספציפית עבור ה-agenda.id הזה
          const voteItem = (firstVote.votes || []).find((v: any) => v.topicIndex === agenda.id)

          // אם נמצאה הצבעה, השתמש בנתונים שלה, אחרת צור ברירת מחדל עבור הנושא
          return {
            subjectId: agenda.id,
            choice: voteItem?.voteDecision || '----',
            questions: {
              hasConflictOfInterest: voteItem?.conflictOfInterest ?? false,
              isRelatedParty: voteItem?.relatedParty ?? false,
              isInvestmentCommittee: voteItem?.investmentCommittee ?? true,
              hasPersonalInterest: voteItem?.personalInterest ?? false,
              conflictOfInterestExplanation: voteItem?.conflictOfInterestExplanation || undefined,
              relatedPartyExplanation: voteItem?.relatedPartyExplanation || undefined,
              personalInterestExplanation: voteItem?.personalInterestExplanation || undefined,
              investmentCommitteeExplanation: voteItem?.investmentCommitteeExplanation || undefined,
            },
          }
        })

        setVotingData({
          generalVotingData: {
            isInterested: firstVote.interested ?? false,
            isSeniorOfficial: firstVote.seniorOfficial ?? false,
            isInstitutionalInvestor: firstVote.institutionalInvestor ?? true,
            interestedExplanation: firstVote.interestedExplanation || undefined,
            seniorOfficialExplanation: firstVote.seniorOfficialExplanation || undefined,
          },
          voterNotes: firstVote.clientComment || '',
          userVotes: transformedUserVotes,
        })
      } else {
        // אין הצבעות קיימות בדאטה, צור ערכי ברירת מחדל לכל החברות ולכל הנושאים
        setVotingData({
          generalVotingData: {
            isInterested: false,
            isSeniorOfficial: false,
            isInstitutionalInvestor: true,
            interestedExplanation: undefined,
            seniorOfficialExplanation: undefined,
          },
          voterNotes: '',
          userVotes: createDefaultAgendaQuestions(meetingData.agendas),
        })
      }
    }
  }, [fetchedVotes, error, isSWRLoading, meetingData, toast])

  const saveDraftData = async (dataType: string, data: any): Promise<void> => {
    console.log(`=== AUTO SAVE - ${dataType} ===`)
    console.log('Data:', data)

    try {
      console.log('meetingData', meetingData)

      const requestBody = {
        meetingId: meetingIdPayload,
        companiesIds: companiesIDs,
        votingData: votingData,
      }

      console.log('Request body:', requestBody)

      const response = await fetch(`/api/votes/upsert-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        toast({
          title: '✅ נתונים נשמרו',
          description: `טיוטה עבור ${dataType} עודכנה בהצלחה`,
          duration: 2000,
        })
      } else {
        const errorData = await response.json()
        console.error('Save error:', errorData)
        toast({
          title: '⚠️ שגיאה בשמירה',
          description: `לא ניתן לשמור טיוטה עבור ${dataType}. ${errorData.error || 'אנא נסה שוב מאוחר יותר.'}`,
          variant: 'destructive',
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: '⚠️ שגיאה בשמירה',
        description: `לא ניתן לשמור טיוטה עבור ${dataType}. אנא נסה שוב מאוחר יותר.`,
        variant: 'destructive',
        duration: 3000,
      })
    }
  }

  const debouncedSave = useCallback(
    (key: string, dataType: string, data: any, delay = 2000) => {
      if (debounceTimers[key]) {
        clearTimeout(debounceTimers[key])
      }

      const newTimer = setTimeout(() => {
        saveDraftData(dataType, data)
        setDebounceTimers((prev) => {
          const newTimers = { ...prev }
          delete newTimers[key]
          return newTimers
        })
      }, delay)

      setDebounceTimers((prev) => ({
        ...prev,
        [key]: newTimer,
      }))
    },
    [debounceTimers],
  )

  //   const handleCompanySelection = (companyId: string, selected: boolean) => {
  //     setVotingData((prev) => ({
  //       ...prev,
  //       holdingCompanies: prev.holdingCompanies.map((company) =>
  //         company.id === companyId ? { ...company, selected } : company,
  //       ),
  //     }))
  // TODO: Implement company selection logic for auto save
  //   }

  // --- פונקציה אחידה לטיפול בשאלות כלליות וגם שאלות סדר יום ---
  const handleQuestionChange = useCallback(
    <T extends GeneralQuestionId | AgendaQuestionId>(
      type: 'general' | 'agenda',
      questionId: T,
      value: boolean,
      explanation?: string,
      subjectId?: string, // רלוונטי רק לשאלות סדר יום
    ) => {
      if (type === 'general') {
        setVotingData((prev) => {
          const newState: GeneralVotingData = { ...prev.generalVotingData, [questionId]: value }
          const generalExplanationFieldName = getExplanationFieldName(
            questionId as GeneralQuestionId,
          )
          if (generalExplanationFieldName) {
            if (value === true && explanation !== undefined) {
              newState[generalExplanationFieldName] = explanation
            } else {
              newState[generalExplanationFieldName] = undefined
            }
          }

          const config = GENERAL_QUESTIONS_CONFIG[questionId as GeneralQuestionId]

          if (explanation !== undefined) {
            // שמירת הסבר ב-debounce
            debouncedSave(
              `general-${questionId}-explanation`,
              config.toastNoteExplanation || config.toastNote,
              newState,
            )
          } else {
            // שמירת בחירה רגילה (כן/לא)
            saveDraftData(config.toastNote, newState)
          }

          return { ...prev, generalVotingData: newState }
        })
      } else if (type === 'agenda' && subjectId) {
        setVotingData((prev) => {
          const newUserVotes = prev.userVotes.map((vote) => {
            if (vote.subjectId === subjectId) {
              const newQuestions: AgendaQuestionsType = { ...vote.questions, [questionId]: value }

              // Explicitly cast questionId to AgendaQuestionId here
              const agendaExplanationFieldName = getExplanationFieldName(
                questionId as AgendaQuestionId,
              )
              if (agendaExplanationFieldName) {
                if (value === true && explanation !== undefined) {
                  newQuestions[agendaExplanationFieldName] = explanation
                } else {
                  newQuestions[agendaExplanationFieldName] = undefined
                }
              }

              return { ...vote, questions: newQuestions }
            }
            return vote
          })

          // אם עדיין אין הצבעה לנושא הזה, נוסיף אובייקט בסיסי
          const existingVote = newUserVotes.find((vote) => vote.subjectId === subjectId)
          if (!existingVote) {
            const initialAgendaQuestions: AgendaQuestionsType = {
              hasConflictOfInterest: null,
              isRelatedParty: null,
              isInvestmentCommittee: true, // ברירת מחדל 'כן' וללא הסבר
              hasPersonalInterest: null,
            }

            const agendaExplanationFieldName = getExplanationFieldName(
              questionId as AgendaQuestionId,
            )
            if (agendaExplanationFieldName && value === true && explanation !== undefined) {
              initialAgendaQuestions[agendaExplanationFieldName] = explanation
            }

            newUserVotes.push({
              subjectId,
              choice: '----',
              questions: { ...initialAgendaQuestions, [questionId]: value },
            })
          }
          const config = AGENDA_QUESTIONS_CONFIG[questionId as AgendaQuestionId]

          if (explanation !== undefined) {
            debouncedSave(
              `agenda-${subjectId}-${questionId}-explanation`,
              config.toastNoteExplanation || config.toastNote,
              newUserVotes,
            )
          } else {
            saveDraftData(config.toastNote, newUserVotes)
          }

          return { ...prev, userVotes: newUserVotes }
        })
      }
    },
    [debouncedSave],
  )

  // פונקציות עטיפה ספציפיות לרכיבים
  const handleGeneralQuestionChangeWrapper = useCallback(
    (questionId: GeneralVotingIDs, value: boolean, explanation?: string) => {
      handleQuestionChange('general', questionId as GeneralQuestionId, value, explanation)
    },
    [handleQuestionChange],
  )

  const handleAgendaQuestionsChangeWrapper = useCallback(
    (questionId: AgendaVotingIDs, value: boolean, explanation?: string, subjectId?: string) => {
      handleQuestionChange('agenda', questionId as AgendaQuestionId, value, explanation, subjectId)
    },
    [handleQuestionChange],
  )

  const handleVoteChange = (subjectId: string, choice: UserVote['choice']) => {
    setVotingData((prev) => {
      const existingVoteIndex = prev.userVotes.findIndex((vote) => vote.subjectId === subjectId)
      let newUserVotes: UserVote[]

      if (existingVoteIndex !== -1) {
        newUserVotes = prev.userVotes.map((vote, index) =>
          index === existingVoteIndex ? { ...vote, choice } : vote,
        )
      } else {
        newUserVotes = [
          ...prev.userVotes,
          {
            subjectId,
            choice,
            questions: {
              hasConflictOfInterest: false,
              isRelatedParty: false,
              isInvestmentCommittee: true, // ברירת מחדל 'כן'
              hasPersonalInterest: false,
            },
          },
        ]
      }
      saveDraftData('הצבעה ', { subjectId, choice })
      return {
        ...prev,
        userVotes: newUserVotes,
      }
    })
  }

  const handleNotesChange = (notes: string) => {
    setVotingData((prev) => ({
      ...prev,
      voterNotes: notes,
    }))
    if (notes.trim() !== '') {
      debouncedSave('voter-notes', 'הערות המצביע', { notes })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...filesArray])
      saveDraftData('קבצים מועלים', { files: filesArray.map((f) => f.name) })
    }
  }

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    saveDraftData('עדכון קבצים', { files: newFiles.map((f) => f.name) })
  }

  return (
    <>
      {meetingData ? (
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
                  onQuestionChangeAction={handleGeneralQuestionChangeWrapper}
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
                      <div
                        key={item.id}
                        className={`${item.isRemovedFromAgenda ? 'opacity-70' : ''}`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-4 pl-3 pr-3">
                          <div>
                            <div className="flex items-start">
                              <span className="text-primary font-bold ml-2 mt-0.5 min-w-[24px]">
                                {itemNumber}.
                              </span>
                              <div className={`flex-1 ${isHebrew ? 'text-right' : 'text-left'}`}>
                                <p
                                  className={`text-foreground font-medium ${
                                    item.isRemovedFromAgenda
                                      ? 'line-through text-muted-foreground'
                                      : ''
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
                                  <SelectItem
                                    value="נגד"
                                    className="text-red-700 dark:text-red-400"
                                  >
                                    נגד
                                  </SelectItem>
                                  <SelectItem value="נמנע">נמנע</SelectItem>
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
                                handleAgendaQuestionsChange={(questionId, value, explanation) =>
                                  handleAgendaQuestionsChangeWrapper(
                                    questionId,
                                    value,
                                    explanation,
                                    item.id,
                                  )
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
                      placeholder="אפרות הוספת הערות..."
                      className=" w-full border-muted bg-background resize-none focus-visible:ring-1"
                      style={{ height: 'calc(100% - 20px)' }}
                      value={votingData.voterNotes}
                      onChange={(e) => handleNotesChange(e.target.value)}
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
      )}
      <Toaster />
    </>
  )
}
