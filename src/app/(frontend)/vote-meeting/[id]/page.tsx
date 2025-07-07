'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { CompanyTableDate } from '../../types/meetings'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import VoteDetails from '../components/VoteDetails'
import VoteCompanySelector from '../components/VoteCompanySelector'
import GeneralQuestions from '../components/GeneralQuestions'
import AgendaQuestions from '../components/AgendaQuestions'
import {
  AgendaQuestionId,
  AgendaQuestionsType,
  AgendaVotingIDs,
  GeneralQuestionId,
  GeneralVotingData,
  GeneralVotingIDs,
  UserVote,
  ValidationError,
  VoteDataType,
} from '../../types/vote'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  AGENDA_QUESTIONS_CONFIG,
  GENERAL_QUESTIONS_CONFIG,
  getExplanationFieldName,
} from '../questionConsts'
import {
  createDefaultAgendaQuestions,
  fetcherVote,
  fetchMeetingData,
  fetchVotedCompanies,
  isGeneralVote,
} from '../../helpers/utils-vote'
import useSWR from 'swr'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip'
import { useParams } from 'next/navigation'
import { PublishSuccessPopup } from '../components/PublishSuccessPopup'
import { Document } from '@/payload-types'
import VoteHeader from '../components/Header'

export default function VotingForm() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const meetingIdFromUrl = params?.id || '-'

  const [isReadOnly, setIsReadOnly] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const [localVoterNotes, setLocalVoterNotes] = useState<string>('')
  const [companiesIDs, setCompaniesIDs] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [votingData, setVotingData] = useState<VoteDataType>({
    generalVotingData: {
      isInterested: false,
      isSeniorOfficial: false,
      isInstitutionalInvestor: true,
    },
    voterNotes: '',
    userVotes: [],
    voteDocuments: [],
  })
  const [initialVotingData, setInitialVotingData] = useState<VoteDataType | null>(null)
  const [isGeneralVoteOption, setIsGeneralVoteOption] = useState<boolean>(true)
  const [lastPublishedVoteInfo, setLastPublishedVoteInfo] = useState<{ user: string; date: Date }>()
  const [publishSuccess, setPublishSuccess] = useState(false)

  const {
    data: meetingData,
    error: meetingDataError,
    isLoading: isMeetingLoading,
  } = useSWR(
    meetingIdFromUrl ? `/api/meetings/by-id?meetingId=${meetingIdFromUrl}` : null,
    fetchMeetingData,
    {
      revalidateOnFocus: false,
    },
  )

  useEffect(() => {
    if (meetingData?.proxyVotingDate) {
      const proxyVotingDate = new Date(meetingData.proxyVotingDate)
      const now = new Date()
      if (proxyVotingDate < now) {
        setIsReadOnly(true)
      }
    } //מה לעשות כשאין תאריל מסירה?
  }, [meetingData])

  useEffect(() => {
    if (meetingDataError) {
      console.error('Error fetching meeting data:', meetingDataError)
      toast({
        title: '⚠️ שגיאה',
        description: 'שגיאה בטעינת נתוני ההצבעה.',
        variant: 'destructive',
        duration: 1500,
      })
      if (typeof window !== 'undefined' && window.history.length > 1) {
        setTimeout(() => router.back(), 2000)
      } else {
        setTimeout(() => router.push('/'), 2000)
      }
    }
  }, [meetingDataError, toast, router])

  const meetingIdPayload = meetingData?.meetingIdPayload || ''
  const meetingCompanies =
    meetingData?.companies.map((company: CompanyTableDate) => company.id) || []

  const swrKeyPublish =
    meetingIdPayload && companiesIDs.length > 0
      ? `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${companiesIDs}&status=published`
      : null

  const { data: publishedVotes, mutate: mutatePublish } = useSWR(swrKeyPublish, fetcherVote, {
    revalidateOnFocus: false,
  })

  const swrKeyDraft =
    meetingIdPayload && companiesIDs.length > 0
      ? `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${companiesIDs}&status=draft`
      : null

  const {
    data: fetchedVotes,
    error: votesError,
    isLoading: isSWRLoading,
    mutate: mutateDraft,
  } = useSWR(swrKeyDraft, fetcherVote, {
    revalidateOnFocus: false,
  })

  const swrKeyDraftAll =
    meetingIdPayload && companiesIDs.length > 0
      ? `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${meetingCompanies}&status=draft`
      : null

  const { data: fetchedVotesAll } = useSWR(swrKeyDraftAll, fetcherVote, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (votesError) {
      console.error('Error fetching vote data with SWR:', votesError)
      toast({
        title: '⚠️ שגיאה בטעינה',
        description: votesError.message || 'לא ניתן לטעון נתוני הצבעה קיימים.',
        variant: 'destructive',
        duration: 2000,
      })
    }
  }, [votesError, toast])

  const swrKeyVotedCompanies =
    meetingIdPayload && meetingCompanies
      ? `/api/votes/voted-companies?meetingId=${meetingIdPayload}&companiesIds=${meetingCompanies}`
      : null

  const { data: votedCompaniesArray, isLoading: isVotedCompaniesArray } = useSWR(
    swrKeyVotedCompanies,
    fetchVotedCompanies,
    {
      revalidateOnFocus: false,
    },
  )

  const isDirty = useMemo(() => {
    if (!initialVotingData) return true
    const currentDataForComparison = {
      ...votingData,
      voteDocuments: uploadedDocs.map((doc) => doc.id).sort(),
    }
    const initialDataForComparison = {
      ...initialVotingData,
      voteDocuments: (initialVotingData.voteDocuments || []).sort(),
    }
    return JSON.stringify(currentDataForComparison) !== JSON.stringify(initialDataForComparison)
  }, [votingData, initialVotingData, uploadedDocs])

  const votedCompanies = useMemo(() => {
    if (isVotedCompaniesArray || !Array.isArray(votedCompaniesArray)) return new Set<string>()
    const votedCompaniesTmp = new Set<string>(
      votedCompaniesArray.map((vote: any) =>
        typeof vote.company === 'string' ? vote.company : vote.company.id,
      ),
    )
    return votedCompaniesTmp
  }, [votedCompaniesArray, isVotedCompaniesArray])

  useEffect(() => {
    if (meetingData?.companies && companiesIDs.length === 0) {
      const defaultIds = meetingData.companies.map((comp: CompanyTableDate) => comp.id)
      setCompaniesIDs(defaultIds)
    }
  }, [meetingData, companiesIDs.length])

  useEffect(() => {
    if (meetingData?.companies.length && fetchedVotes?.length) {
      const defaultIds = meetingData.companies.map((comp: CompanyTableDate) => comp.id)
      if (fetchedVotes && fetchedVotes.length > 0 && fetchedVotes.length < companiesIDs.length) {
        setIsGeneralVoteOption(false)
        setCompaniesIDs([defaultIds[0]])
      } else {
        let isGeneralVoteOptionTmp
        if (fetchedVotes?.length == 1 && meetingData?.companies.length > 1) {
          isGeneralVoteOptionTmp = isGeneralVote([
            ...(fetchedVotes || []),
            ...(fetchedVotesAll || []),
          ])
        } else {
          isGeneralVoteOptionTmp = isGeneralVote(fetchedVotes)
        }
        setIsGeneralVoteOption(isGeneralVoteOptionTmp)
        if (companiesIDs.length > 1 && isGeneralVoteOptionTmp !== isGeneralVoteOption) {
          if (isGeneralVoteOptionTmp) {
            setCompaniesIDs(defaultIds)
          } else {
            setCompaniesIDs([defaultIds[0]])
          }
        }
      }
    }
  }, [fetchedVotes, meetingData?.companies, fetchedVotesAll])

  useEffect(() => {
    if (isMeetingLoading || isSWRLoading || !meetingData) {
      return
    }
    let initialData: VoteDataType
    let publishedData: VoteDataType | null = null

    if (!fetchedVotes || fetchedVotes.length === 0) {
      initialData = {
        generalVotingData: {
          isInterested: false,
          isSeniorOfficial: false,
          isInstitutionalInvestor: true,
        },
        voterNotes: '',
        userVotes: createDefaultAgendaQuestions(
          meetingData.agendas,
          meetingData.defaultVotingRecommendation,
        ),
        voteDocuments: [],
      }
      setUploadedDocs([])
    } else {
      // Case where we have fetched votes
      if (!publishedVotes || !publishedVotes.length) {
        setLastPublishedVoteInfo(undefined)
      } else {
        const lastPublishedVoteInfoTmp = {
          user: publishedVotes[0].publisher || '',
          date: publishedVotes[0].updatedAt || ' לא ידוע',
        }
        setLastPublishedVoteInfo(lastPublishedVoteInfoTmp)
      }

      const firstVote = fetchedVotes[0]
      if (firstVote.voteDocuments && Array.isArray(firstVote.voteDocuments)) {
        setUploadedDocs(
          firstVote.voteDocuments.filter((doc: { id: any }) => typeof doc === 'object' && doc.id),
        )
      } else {
        setUploadedDocs([])
      }
      const transformedUserVotes = meetingData.agendas.map((agenda) => {
        const voteItem = (firstVote.votes || []).find((v: any) => v.topicIndex == agenda.topicIndex)
        return {
          topicIndex: agenda.topicIndex,
          choice: voteItem?.voteDecision || '',
          questions: {
            hasConflictOfInterest: voteItem?.hasConflictOfInterest ?? false,
            isRelatedParty: voteItem?.isRelatedParty ?? false,
            isInvestmentCommittee: voteItem?.isInvestmentCommittee ?? true,
            hasPersonalInterest: voteItem?.hasPersonalInterest ?? false,
            conflictOfInterestExplanation: voteItem?.conflictOfInterestExplanation || '',
            relatedPartyExplanation: voteItem?.relatedPartyExplanation || '',
            personalInterestExplanation: voteItem?.personalInterestExplanation || '',
          },
          privilegedMajority: agenda.privilegedMajority,
          isRemovedFromAgenda: agenda.isRemovedFromAgenda,
        }
      })
      initialData = {
        generalVotingData: {
          isInterested: firstVote.isInterested ?? false,
          isSeniorOfficial: firstVote.isSeniorOfficial ?? false,
          isInstitutionalInvestor: firstVote.isInstitutionalInvestor ?? true,
          interestedExplanation: firstVote.interestedExplanation || '',
          seniorOfficialExplanation: firstVote.seniorOfficialExplanation || '',
        },
        voterNotes: firstVote.clientComment || '',
        userVotes: transformedUserVotes,
        voteDocuments: Array.isArray(firstVote.voteDocuments)
          ? firstVote.voteDocuments.map((doc: { id: any }) => doc.id)
          : [],
      }
    }

    if (publishedVotes && publishedVotes.length > 0) {
      const firstPublishedVote = publishedVotes[0]
      const transformedPublishedUserVotes = meetingData.agendas.map((agenda) => {
        const voteItem = (firstPublishedVote.votes || []).find(
          (v: any) => v.topicIndex == agenda.topicIndex,
        )
        return {
          topicIndex: agenda.topicIndex,
          choice: voteItem?.voteDecision || '',
          questions: {
            hasConflictOfInterest: voteItem?.hasConflictOfInterest ?? false,
            isRelatedParty: voteItem?.isRelatedParty ?? false,
            isInvestmentCommittee: voteItem?.isInvestmentCommittee ?? true,
            hasPersonalInterest: voteItem?.hasPersonalInterest ?? false,
            conflictOfInterestExplanation: voteItem?.conflictOfInterestExplanation || '',
            relatedPartyExplanation: voteItem?.relatedPartyExplanation || '',
            personalInterestExplanation: voteItem?.personalInterestExplanation || '',
          },
          privilegedMajority: agenda.privilegedMajority,
          isRemovedFromAgenda: agenda.isRemovedFromAgenda,
        }
      })
      publishedData = {
        generalVotingData: {
          isInterested: firstPublishedVote.isInterested ?? false,
          isSeniorOfficial: firstPublishedVote.isSeniorOfficial ?? false,
          isInstitutionalInvestor: firstPublishedVote.isInstitutionalInvestor ?? true,
          interestedExplanation: firstPublishedVote.interestedExplanation || '',
          seniorOfficialExplanation: firstPublishedVote.seniorOfficialExplanation || '',
        },
        voterNotes: firstPublishedVote.clientComment || '',
        userVotes: transformedPublishedUserVotes,
        voteDocuments: Array.isArray(firstPublishedVote.voteDocuments)
          ? firstPublishedVote.voteDocuments.map((doc: { id: any }) => doc.id)
          : [],
      }
    }

    setVotingData(initialData)
    setInitialVotingData(publishedData ? structuredClone(publishedData) : null)
  }, [fetchedVotes, isSWRLoading, meetingData, isMeetingLoading, publishedVotes])

  useEffect(() => {
    setLocalVoterNotes(votingData.voterNotes || '')
  }, [votingData.voterNotes])

  const validateForm = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = []

    // Validate general questions
    const generalData = votingData.generalVotingData

    // Check if explanation is required for general questions
    if (generalData.isInterested && !generalData.interestedExplanation?.trim()) {
      errors.push({
        field: 'interestedExplanation',
        message: 'נדרש הסבר לעניין אישי',
        type: 'general',
      })
    }

    if (generalData.isSeniorOfficial && !generalData.seniorOfficialExplanation?.trim()) {
      errors.push({
        field: 'seniorOfficialExplanation',
        message: 'נדרש הסבר לנושא תפקיד בכיר',
        type: 'general',
      })
    }

    // Validate agenda items
    if (meetingData?.agendas) {
      meetingData.agendas.forEach((agenda) => {
        if (agenda.isRemovedFromAgenda) return

        const userVote = votingData.userVotes.find((v) => v.topicIndex === agenda.topicIndex)

        // Check if vote choice is selected
        if (!userVote?.choice) {
          errors.push({
            field: 'choice',
            message: 'יש לבחור הצבעה',
            type: 'agenda',
            topicIndex: agenda.topicIndex,
          })
        }

        // Check agenda question explanations
        if (userVote?.questions) {
          const questions = userVote.questions

          if (questions.hasConflictOfInterest && !questions.conflictOfInterestExplanation?.trim()) {
            errors.push({
              field: 'conflictOfInterestExplanation',
              message: 'נדרש הסבר לניגוד עניינים',
              type: 'agenda',
              topicIndex: agenda.topicIndex,
            })
          }

          if (questions.isRelatedParty && !questions.relatedPartyExplanation?.trim()) {
            errors.push({
              field: 'relatedPartyExplanation',
              message: 'נדרש הסבר לבעל עניין',
              type: 'agenda',
              topicIndex: agenda.topicIndex,
            })
          }

          if (questions.hasPersonalInterest && !questions.personalInterestExplanation?.trim()) {
            errors.push({
              field: 'personalInterestExplanation',
              message: 'נדרש הסבר לעניין אישי',
              type: 'agenda',
              topicIndex: agenda.topicIndex,
            })
          }
        }
      })
    }

    return errors
  }, [votingData, meetingData])

  const getFieldError = useCallback(
    (
      fieldName: string,
      type: 'general' | 'agenda',
      topicIndex?: number,
    ): ValidationError | undefined => {
      return validationErrors.find(
        (error) =>
          error.field === fieldName &&
          error.type === type &&
          (type === 'agenda' ? error.topicIndex === topicIndex : true),
      )
    },
    [validationErrors],
  )

  const savePublish = useCallback(
    async (currentVotingData: VoteDataType) => {
      // Clear previous errors
      setValidationErrors([])

      // Validate form
      const errors = validateForm()
      if (errors.length > 0) {
        setValidationErrors(errors)
        // Scroll to the first error
        const firstError = errors[0]
        const errorElement = document.querySelector(
          `[data-field-name="${firstError.field}"][data-topic-index="${firstError.topicIndex || ''}"]`,
        )
        errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => {
          toast({
            title: '⚠️  נדרש מידע נוסף',
            description: 'יש למלא את כל השדות החובה המסומנים',
            duration: 3000,
          })
        }, 0)
        return
      }

      setIsSubmitting(true)

      try {
        const response = await fetch('/api/votes/publish-votes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meetingId: meetingIdPayload,
            companiesIds: companiesIDs,
            votingData: currentVotingData,
          }),
        })

        const result = await response.json()

        if (response.ok) {
          window.scrollTo({ top: 0, behavior: 'smooth' })
          setPublishSuccess(true)
          mutatePublish()
        } else {
          throw new Error(result.error || 'שגיאה בשליחת ההצבעה')
        }
      } catch (error: any) {
        console.error('Submit error:', error)
        toast({
          title: '⚠️ שגיאה בשליחה',
          description: error.message || 'לא ניתן לשלוח את ההצבעה. אנא נסה שוב.',
          variant: 'destructive',
          duration: 3000,
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [validateForm, meetingIdPayload, companiesIDs, toast, router, mutatePublish, uploadedDocs],
  )

  const saveDraftData = useCallback(
    async (dataType: string, currentVotingData: VoteDataType): Promise<void> => {
      if (!meetingIdPayload || companiesIDs.length === 0 || !currentVotingData || !meetingData) {
        console.warn('Missing data for saveDraftData. Aborting save.')

        setTimeout(() => {
          toast({
            title: '⚠️ שגיאה בשמירה',
            description: 'נתונים חיוניים חסרים לשמירת הטיוטה. אנא נסה שוב.',
            variant: 'destructive',
            duration: 2000,
          })
        }, 0)
        return
      }
      try {
        const requestBody = {
          meetingId: meetingIdPayload,
          companiesIds: companiesIDs,
          votingData: currentVotingData,
        }
        const response = await fetch(`/api/votes/upsert-draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (response.ok) {
          toast({
            title: '✅ נתונים נשמרו',
            description: `טיוטה עבור ${dataType} עודכנה בהצלחה`,
            duration: 1500,
          })
          mutateDraft()
        } else {
          const errorData = await response.json()
          console.error('Save error:', errorData)
          toast({
            title: '⚠️ שגיאה בשמירה',
            description: `לא ניתן לשמור טיוטה עבור ${dataType}. ${errorData.error || 'אנא נסה שוב מאוחר יותר.'}`,
            variant: 'destructive',
            duration: 2000,
          })
        }
      } catch (error) {
        console.error('Save error:', error)
        toast({
          title: '⚠️ שגיאה בשמירה',
          description: `לא ניתן לשמור טיוטה עבור ${dataType}. אנא נסה שוב מאוחר יותר.`,
          variant: 'destructive',
          duration: 2000,
        })
      }
    },
    [meetingIdPayload, companiesIDs, meetingData, toast, mutateDraft, uploadedDocs],
  )

  const handleQuestionChange = useCallback(
    <T extends GeneralQuestionId | AgendaQuestionId>(
      type: 'general' | 'agenda',
      questionId: T,
      value: boolean,
      explanation?: string,
      topicIndex?: number, // Relevant only for agenda questions
    ) => {
      // Clear validation errors for this field when user makes changes
      setValidationErrors((prev) =>
        prev.filter((error) => {
          if (type === 'general') {
            return !(
              error.field === questionId ||
              error.field === getExplanationFieldName(questionId as GeneralQuestionId)
            )
          }
          return !(
            error.topicIndex === topicIndex &&
            (error.field === questionId ||
              error.field === getExplanationFieldName(questionId as AgendaQuestionId))
          )
        }),
      )

      if (type === 'general') {
        const config = GENERAL_QUESTIONS_CONFIG[questionId as GeneralQuestionId]
        const dataType =
          explanation !== undefined
            ? config.toastNoteExplanation || config.toastNote
            : config.toastNote

        setVotingData((prev) => {
          const newGeneralData: GeneralVotingData = {
            ...prev.generalVotingData,
            [questionId]: value,
          }
          const generalExplanationFieldName = getExplanationFieldName(
            questionId as GeneralQuestionId,
          )
          if (generalExplanationFieldName) {
            newGeneralData[generalExplanationFieldName] = value === true ? explanation || '' : ''
          }

          const updatedVotingData = { ...prev, generalVotingData: newGeneralData }
          saveDraftData(dataType, updatedVotingData)
          return updatedVotingData
        })
      } else if (type === 'agenda' && topicIndex !== undefined) {
        const config = AGENDA_QUESTIONS_CONFIG[questionId as AgendaQuestionId]
        const dataType =
          explanation !== undefined
            ? config.toastNoteExplanation || config.toastNote
            : config.toastNote

        setVotingData((prev) => {
          const newUserVotes = prev.userVotes.map((vote) => {
            if (vote.topicIndex == topicIndex) {
              const newQuestions: AgendaQuestionsType = {
                ...vote.questions,
                [questionId]: value,
              }
              const agendaExplanationFieldName = getExplanationFieldName(
                questionId as AgendaQuestionId,
              )
              if (agendaExplanationFieldName) {
                newQuestions[agendaExplanationFieldName] = value === true ? explanation || '' : ''
              }
              return { ...vote, questions: newQuestions }
            }
            return vote
          })

          const updatedVotingData = { ...prev, userVotes: newUserVotes }
          saveDraftData(dataType, updatedVotingData)
          return updatedVotingData
        })
      }
    },
    [saveDraftData],
  )

  const handleGeneralQuestionChangeWrapper = useCallback(
    (questionId: GeneralVotingIDs, value: boolean, explanation?: string) => {
      handleQuestionChange('general', questionId as GeneralQuestionId, value, explanation)
    },
    [handleQuestionChange],
  )

  const handleAgendaQuestionsChangeWrapper = useCallback(
    (questionId: AgendaVotingIDs, value: boolean, explanation?: string, topicIndex?: number) => {
      handleQuestionChange('agenda', questionId as AgendaQuestionId, value, explanation, topicIndex)
    },
    [handleQuestionChange],
  )

  const handleVoteChange = (topicIndex: number, choice: UserVote['choice']) => {
    // Clear validation error for this vote choice
    setValidationErrors((prev) =>
      prev.filter((error) => !(error.topicIndex === topicIndex && error.field === 'choice')),
    )

    setVotingData((prev) => {
      const existingVoteIndex = prev.userVotes.findIndex((vote) => vote.topicIndex == topicIndex)
      let newUserVotes: UserVote[]

      if (existingVoteIndex !== -1) {
        newUserVotes = prev.userVotes.map((vote, index) =>
          index === existingVoteIndex ? { ...vote, choice } : vote,
        )
        const updatedVotingData = {
          ...prev,
          userVotes: newUserVotes,
        }
        saveDraftData('הצבעה', updatedVotingData)

        return updatedVotingData
      }
      return prev
    })
  }
  const handleNotesChange = () => {
    if (votingData.voterNotes !== localVoterNotes) {
      setVotingData((prev) => {
        const updatedVotingData = { ...prev, voterNotes: localVoterNotes }
        saveDraftData('הערות המצביע', updatedVotingData)
        return updatedVotingData
      })
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      if (filesArray.length === 0) return

      setIsUploading(true)
      try {
        const uploadPromises = filesArray.map((file) => {
          const formData = new FormData()
          formData.append('file', file)
          return fetch('/api/documents', {
            method: 'POST',
            body: formData,
          }).then((res) => {
            if (!res.ok) throw new Error('File upload failed')
            return res.json()
          })
        })

        const results = await Promise.all(uploadPromises)
        const newDocs = results.map((result) => result.doc)

        setUploadedDocs((prev) => {
          const updatedDocs = [...prev, ...newDocs]
          setVotingData((currentVotingData) => {
            const updatedVotingData = {
              ...currentVotingData,
              voteDocuments: updatedDocs.map((d) => d.id),
            }
            saveDraftData('קובץ', updatedVotingData)
            return updatedVotingData
          })
          return updatedDocs
        })
      } catch (error) {
        console.error('Upload error:', error)
        toast({
          title: '⚠️ שגיאה בהעלאת קובץ',
          description: 'לא ניתן היה להעלות את הקובץ. נסה שוב',
          variant: 'destructive',
          duration: 2000,
        })
      } finally {
        setIsUploading(false)
        e.target.value = ''
      }
    }
  }

  const removeFile = (docIdToRemove: string) => {
    setUploadedDocs((prev) => {
      const newDocs = prev.filter((doc) => doc.id !== docIdToRemove)
      setVotingData((currentVotingData) => {
        const updatedVotingData = {
          ...currentVotingData,
          voteDocuments: newDocs.map((d) => d.id),
        }
        saveDraftData('עדכון קבצים', updatedVotingData)
        return updatedVotingData
      })
      return newDocs
    })
  }

  return (
    <>
      {meetingData && !isMeetingLoading && !isSWRLoading ? (
        <div className="w-full mx-auto py-6 px-4 sm:px-6 lg:px-8 rtl">
          <VoteHeader
            meetingData={{
              meetingInviteUrl: meetingData.meetingInviteUrl,
              meetingType: meetingData.meetingType,
              stockName: meetingData.meetingType,
            }}
            isReadOnly={isReadOnly}
            isDirty={isDirty}
            lastPublishedVoteInfo={lastPublishedVoteInfo}
            fetchedVotes={fetchedVotes}
          />

          {/* Main content */}
          <div className="space-y-6">
            <VoteDetails meetingData={meetingData} isReadOnly={isReadOnly} />
            <Card>
              <CardHeader className="bg-primary/10 py-1.5 px-3">
                <h2 className="text-sm font-medium text-primary">בחירת חברה</h2>
              </CardHeader>
              <CardContent className="p-4">
                <VoteCompanySelector
                  meetingData={meetingData}
                  meetingCompanies={meetingData.companies}
                  companiesIDs={companiesIDs}
                  setCompaniesIDsAction={setCompaniesIDs}
                  isGeneralVoteOption={isGeneralVoteOption}
                  votedCompanies={votedCompanies}
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
                  getFieldErrorAction={getFieldError}
                  isReadOnly={isReadOnly}
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
                    const userVote = votingData.userVotes.find(
                      (v) => v.topicIndex == item.topicIndex,
                    )
                    const choiceError = getFieldError('choice', 'agenda', item.topicIndex)
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
                              {item.recommendation.votingRecommendation &&
                                meetingData?.displayVotingRecommendation && (
                                  <span
                                    className={`inline-block text-xs px-2 py-1 rounded-full border w-full text-center ${
                                      item.recommendation.votingRecommendation === 'בעד'
                                        ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
                                        : item.recommendation.votingRecommendation === 'נגד'
                                          ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
                                          : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900'
                                    }`}
                                  >
                                    המלצה: {item.recommendation.votingRecommendation}
                                  </span>
                                )}
                              <Select
                                value={userVote?.choice || undefined}
                                onValueChange={(value) =>
                                  handleVoteChange(item.topicIndex, value as UserVote['choice'])
                                }
                                disabled={isReadOnly}
                              >
                                <SelectTrigger
                                  className={`w-full ${
                                    choiceError
                                      ? 'border-red-500 ring-1 ring-red-500'
                                      : userVote?.choice === 'בעד'
                                        ? 'border-green-500 bg-green-100 dark:bg-green-950 dark:border-green-800'
                                        : userVote?.choice === 'נגד'
                                          ? 'border-red-500 bg-red-100 dark:bg-red-950 dark:border-red-800'
                                          : 'border-input'
                                  }`}
                                >
                                  <SelectValue placeholder="בחר הצבעה" />
                                </SelectTrigger>
                                <SelectContent>
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
                                  <SelectItem value="----">----</SelectItem>
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
                                handleAgendaQuestionsChangeAction={(
                                  questionId,
                                  value,
                                  explanation,
                                ) =>
                                  handleAgendaQuestionsChangeWrapper(
                                    questionId,
                                    value,
                                    explanation,
                                    item.topicIndex,
                                  )
                                }
                                getFieldErrorAction={getFieldError}
                                topicIndex={item.topicIndex}
                                isReadOnly={isReadOnly}
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
                  <div>
                    <div className="flex items-center mb-2">
                      <h3 className="text-xs font-medium text-muted-foreground">הערות המצביע</h3>
                    </div>
                    <Textarea
                      placeholder="אפשרות הוספת הערות..."
                      className=" w-full border-muted bg-background resize-none focus-visible:ring-1"
                      style={{ height: 'calc(100% - 20px)' }}
                      value={localVoterNotes}
                      onChange={(e) => setLocalVoterNotes(e.target.value)}
                      onBlur={handleNotesChange}
                      readOnly={isReadOnly}
                    />
                  </div>
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
                          disabled={isUploading || isReadOnly}
                        />
                        <label
                          htmlFor="file-upload"
                          className={`flex items-center gap-2 bg-background border border-input rounded-md p-2 transition-colors ${isUploading || isReadOnly ? 'cursor-default bg-muted/50' : 'cursor-pointer hover:bg-muted/50'}`}
                        >
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {isUploading ? 'מעלה קבצים...' : 'בחר קובץ/קבצים'}
                          </span>
                        </label>
                      </div>

                      {uploadedDocs.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {uploadedDocs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-1.5 text-xs"
                            >
                              <a
                                href={doc.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate max-w-[150px] hover:underline"
                              >
                                {doc.filename}
                              </a>
                              <button
                                type="button"
                                onClick={() => removeFile(doc.id)}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        onClick={() =>
                          setVotingData((currentVotingData) => {
                            savePublish(currentVotingData)
                            return currentVotingData
                          })
                        }
                        disabled={!isDirty || isSubmitting || isUploading || isReadOnly}
                        className="px-8"
                      >
                        {isSubmitting ? 'שולח...' : 'שליחת הצבעה'}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {(!isDirty || isSubmitting || isUploading || isReadOnly) && (
                    <TooltipContent className="m-1 mx-3">
                      {!isDirty
                        ? 'אין שינוי מההצבעה שנשלחה לעמדה'
                        : isUploading
                          ? 'אנא המתן לסיום העלאת הקבצים'
                          : isReadOnly
                            ? 'זמן ההצבעה עבר, אין אפשרות לשלוח הצבעה'
                            : 'הצבעה נשלחת, אנא המתן'}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
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
      <PublishSuccessPopup isOpen={publishSuccess} onClose={() => setPublishSuccess(false)} />
    </>
  )
}
