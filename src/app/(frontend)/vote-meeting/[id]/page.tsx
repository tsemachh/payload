'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Upload } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useParams, useRouter } from 'next/navigation'
import { useNavigationGuard } from 'next-navigation-guard'
import { CompanyTableData } from '../../types/meetings'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import VoteDetails from '../components/VoteDetails'
import VoteCompanySelector from '../components/VoteCompanySelector'
import GeneralQuestions from '../components/GeneralQuestions'
import AgendaQuestions from '../components/AgendaQuestions'
import VoteReason from '../components/VoteReason'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  DynamicQuestionAnswer,
} from '../../types/vote'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { handleApiError } from '../../helpers/error-handler'
import { postWithErrorHandling } from '../../helpers/fetch-helpers'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PublishSuccessPopup } from '../components/PublishSuccessPopup'
import { Document } from '@/payload-types'
import VoteHeader from '../components/Header'
import { hasCompanyPermission } from '@/utils/permissions'
import { useAuth } from '@/providers/auth-provider'
import { useImpersonation } from '@/plugins/impersonate/components'

export default function VotingForm() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    if (user === null) {
      const currentPath = window.location.pathname + window.location.search
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(currentPath)}`)
      return
    }
  }, [user, router])

  if (user === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinnerDiamond />
      </div>
    )
  }

  const meetingIdFromUrl = params?.id || '-'

  const [isReadOnly, setIsReadOnly] = useState(false)
  const [readOnlyReason, setReadOnlyReason] = useState<'date' | 'permission' | null>(null)
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
  const [isDraftSaved, setIsDraftSaved] = useState(false)

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

  const { isImpersonating } = useImpersonation()

  useEffect(() => {
    if (meetingData) {
      let isReadOnlyDueToDate = false
      if (meetingData.proxyVotingDate) {
        const proxyVotingDate = new Date(meetingData.proxyVotingDate)
        const now = new Date()
        if (proxyVotingDate < now && !isImpersonating) {
          isReadOnlyDueToDate = true
        }
      }

      let isReadOnlyDueToPermission = false
      if (user && meetingData?.companies.length > 0) {
        const hasWritePermission = hasCompanyPermission(user, meetingData?.companies[0].id, 'write')
        if (!hasWritePermission) {
          isReadOnlyDueToPermission = true
        }
      }

      if (isReadOnlyDueToPermission) {
        setReadOnlyReason('permission')
      } else if (isReadOnlyDueToDate) {
        setReadOnlyReason('date')
      } else {
        setReadOnlyReason(null)
      }

      setIsReadOnly(isReadOnlyDueToDate || isReadOnlyDueToPermission)
    }
  }, [meetingData, user, isImpersonating])

  useEffect(() => {
    if (meetingDataError) {
      console.error('Error fetching meeting data:', meetingDataError)
      toast({
        title: '⚠️ שגיאה',
        description: 'שגיאה בטעינת נתוני ההצבעה.',
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
    meetingData?.companies.map((company: CompanyTableData) => company.id) || []

  const swrKeyPublish =
    meetingIdPayload && companiesIDs.length > 0
      ? `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${companiesIDs}&status=published`
      : null

  const { data: publishedVotes, mutate: mutatePublish } = useSWR(swrKeyPublish, fetcherVote, {
    revalidateOnFocus: false,
  })
  // publishedVotes is an array of full vote objects
  const reportApproval = publishedVotes?.[0]?.reportApproval
  const reported = publishedVotes?.[0]?.reported
  const swrKey =
    meetingIdPayload && companiesIDs.length > 0
      ? `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${companiesIDs}&status=${isReadOnly ? 'published' : 'draft'}`
      : null

  const {
    data: fetchedVotes,
    error: votesError,
    isLoading: isSWRLoading,
    mutate: mutateDraft,
  } = useSWR(swrKey, fetcherVote, {
    revalidateOnFocus: false,
  })

  const swrKeyAll =
    meetingIdPayload && companiesIDs.length > 0
      ? `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${meetingCompanies}&status=${isReadOnly ? 'published' : 'latest'}`
      : null

  const { data: fetchedAllLatestVotes, mutate: mutateAllLatestVotes } = useSWR(
    swrKeyAll,
    fetcherVote,
    {
      revalidateOnFocus: false,
    },
  )

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

  const {
    data: votedCompaniesArray,
    isLoading: isVotedCompaniesArray,
    mutate: mutateVotedCompaniesArray,
  } = useSWR(swrKeyVotedCompanies, fetchVotedCompanies, {
    revalidateOnFocus: false,
  })

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
    return new Set<string>(
      votedCompaniesArray.map((vote: any) =>
        typeof vote.company === 'string' ? vote.company : vote.company.id,
      ),
    )
  }, [votedCompaniesArray, isVotedCompaniesArray])

  useEffect(() => {
    if (meetingData?.companies && companiesIDs.length === 0) {
      const defaultIds = meetingData.companies.map((comp: CompanyTableData) => comp.id)
      setCompaniesIDs(defaultIds)
    }
  }, [meetingData, companiesIDs.length])

  useEffect(() => {
    if (meetingData?.companies.length && fetchedVotes?.length) {
      const defaultIds = meetingData.companies.map((comp: CompanyTableData) => comp.id)
      let isGeneralVoteOptionTmp
      if (
        fetchedAllLatestVotes &&
        fetchedAllLatestVotes.length > 0 &&
        fetchedAllLatestVotes.length < defaultIds.length
      ) {
        isGeneralVoteOptionTmp = false
      } else {
        isGeneralVoteOptionTmp = isGeneralVote(fetchedAllLatestVotes)
      }
      if (companiesIDs.length > 1 && isGeneralVoteOptionTmp !== isGeneralVoteOption) {
        if (isGeneralVoteOptionTmp) {
          setCompaniesIDs(defaultIds)
        } else {
          setCompaniesIDs([defaultIds[0]])
        }
      }
      setIsGeneralVoteOption(isGeneralVoteOptionTmp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedVotes, meetingData?.companies, fetchedAllLatestVotes])

  useEffect(() => {
    if (isMeetingLoading || isSWRLoading || !meetingData) {
      return
    }
    // Reset isDraftSaved when loading a new meeting
    setIsDraftSaved(false)
    let initialData: VoteDataType
    let publishedData: VoteDataType | null = null

    // Initialize dynamic questions from meeting data
    const dynamicQuestions: DynamicQuestionAnswer[] = meetingData.relatedQuestions?.questions
      ? meetingData.relatedQuestions.questions.map((q) => {
          return {
            questionId: q.id,
            questionText: q.questionText,
            answer: q.defaultValue || false,
            explanation: '',
          }
        })
      : []

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
        dynamicQuestions,
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
          voteReason: voteItem?.voteReason || '',
          privilegedMajority: agenda.privilegedMajority,
          isRemovedFromAgenda: agenda.isRemovedFromAgenda,
        }
      })

      // Load dynamic questions answers from saved vote
      const savedDynamicQuestions: DynamicQuestionAnswer[] = meetingData.relatedQuestions?.questions
        ? meetingData.relatedQuestions.questions.map((q) => {
            const savedAnswer = firstVote.dynamicQuestions?.find(
              (dq: any) => dq.questionId === q.id,
            )
            return {
              questionId: q.id,
              questionText: q.questionText,
              answer: savedAnswer?.answer ?? (q.defaultValue || false),
              explanation: savedAnswer?.explanation || '',
            }
          })
        : []
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
        dynamicQuestions: savedDynamicQuestions,
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
          voteReason: voteItem?.voteReason || '',
          privilegedMajority: agenda.privilegedMajority,
          isRemovedFromAgenda: agenda.isRemovedFromAgenda,
        }
      })

      // Load published dynamic questions answers
      const publishedDynamicQuestions: DynamicQuestionAnswer[] = meetingData.relatedQuestions
        ?.questions
        ? meetingData.relatedQuestions.questions.map((q) => {
            const savedAnswer = firstPublishedVote.dynamicQuestions?.find(
              (dq: any) => dq.questionId === q.id,
            )
            return {
              questionId: q.id,
              questionText: q.questionText,
              answer: savedAnswer?.answer ?? (q.defaultValue || false),
              explanation: savedAnswer?.explanation || '',
            }
          })
        : []

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
        dynamicQuestions: publishedDynamicQuestions,
      }
    }

    console.log('Setting votingData with initialData:', initialData)
    setVotingData(initialData)
    setInitialVotingData(publishedData ? structuredClone(publishedData) : null)
  }, [fetchedVotes, isSWRLoading, meetingData, isMeetingLoading, publishedVotes, setIsDraftSaved])

  useEffect(() => {
    setLocalVoterNotes(votingData.voterNotes || '')
  }, [votingData.voterNotes])

  // Use navigation guard hook for back button and browser navigation
  const navGuard = useNavigationGuard({
    enabled: (isDirty || isDraftSaved) && !isReadOnly,
  })

  const validateForm = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = []

    // Check if we have dynamic questions (relatedQuestions)
    const hasDynamicQuestions =
      meetingData?.relatedQuestions &&
      meetingData.relatedQuestions.questions &&
      meetingData.relatedQuestions.questions.length > 0

    if (hasDynamicQuestions) {
      // Validate dynamic questions
      votingData.dynamicQuestions?.forEach((dq) => {
        // If answer is true, explanation is required
        if (dq.answer && !dq.explanation?.trim()) {
          errors.push({
            field: `dynamicQuestion_${dq.questionId}`,
            message: 'נדרש הסבר',
            type: 'general',
          })
        }
      })
    } else {
      // Validate static general questions (old behavior)
      const generalData = votingData.generalVotingData

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
    async () => {
      // Trigger blur on all textareas to ensure all changes are saved
      const textareas = document.querySelectorAll('textarea')
      textareas.forEach((textarea) => {
        if (textarea === document.activeElement) {
          textarea.blur()
        }
      })

      // Wait for blur handlers to complete and state to update
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Use the latest votingData from state (updated after blur)
      const latestVotingData = votingData
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
        await postWithErrorHandling(
          '/api/votes/publish-votes',
          {
            meetingId: meetingIdPayload,
            companiesIds: companiesIDs,
            votingData: latestVotingData,
          },
          {
            errorMessage: 'שגיאה בשליחת ההצבעה',
          },
        )

        window.scrollTo({ top: 0, behavior: 'smooth' })
        setPublishSuccess(true)
        mutatePublish()
        mutateAllLatestVotes()
        mutateVotedCompaniesArray()
      } catch (error: any) {
        // Error already logged and notified by postWithErrorHandling
        // Additional error handling if needed
      } finally {
        setIsSubmitting(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      votingData,
      validateForm,
      meetingIdPayload,
      companiesIDs,
      toast,
      router,
      mutatePublish,
      mutateAllLatestVotes,
      mutateVotedCompaniesArray,
    ],
  )

  const saveDraftData = useCallback(
    async (
      dataType: string,
      currentVotingData: VoteDataType,
      skipMutate: boolean = false,
    ): Promise<void> => {
      if (!meetingIdPayload || companiesIDs.length === 0 || !currentVotingData || !meetingData) {
        console.warn('Missing data for saveDraftDataAction. Aborting save.')

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

        await postWithErrorHandling('/api/votes/upsert-draft', requestBody, {
          errorMessage: `לא ניתן לשמור טיוטה עבור ${dataType}`,
          notifyOnError: true, // We'll handle notification ourselves for success case
        })

        setIsDraftSaved(true)
        toast({
          title: '✅ נתונים נשמרו',
          description: `טיוטה עבור ${dataType} עודכנה בהצלחה`,
          duration: 1500,
        })

        // Skip mutate for dynamic questions to avoid overwriting state
        if (!skipMutate) {
          mutateDraft()
          mutateAllLatestVotes()
        }
      } catch (error) {
        //Handle rollback in UI level on Error
      }
    },
    [
      meetingIdPayload,
      companiesIDs,
      meetingData,
      toast,
      mutateDraft,
      setIsDraftSaved,
      mutateAllLatestVotes,
    ],
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

        const newGeneralData: GeneralVotingData = {
          ...votingData.generalVotingData,
          [questionId]: value,
        }
        const generalExplanationFieldName = getExplanationFieldName(questionId as GeneralQuestionId)
        if (generalExplanationFieldName) {
          newGeneralData[generalExplanationFieldName] = value ? explanation || '' : ''
        }
        const updatedVotingData = { ...votingData, generalVotingData: newGeneralData }

        setVotingData(updatedVotingData)
        saveDraftData(dataType, updatedVotingData)
      } else if (type === 'agenda' && topicIndex !== undefined) {
        const config = AGENDA_QUESTIONS_CONFIG[questionId as AgendaQuestionId]
        const dataType =
          explanation !== undefined
            ? config.toastNoteExplanation || config.toastNote
            : config.toastNote

        const newUserVotes = votingData.userVotes.map((vote) => {
          if (vote.topicIndex == topicIndex) {
            const newQuestions: AgendaQuestionsType = {
              ...vote.questions,
              [questionId]: value,
            }
            const agendaExplanationFieldName = getExplanationFieldName(
              questionId as AgendaQuestionId,
            )
            if (agendaExplanationFieldName) {
              newQuestions[agendaExplanationFieldName] = value ? explanation || '' : ''
            }
            return { ...vote, questions: newQuestions }
          }
          return vote
        })
        const updatedVotingData = { ...votingData, userVotes: newUserVotes }

        setVotingData(updatedVotingData)
        saveDraftData(dataType, updatedVotingData)
      }
    },
    [votingData, saveDraftData],
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

    const newUserVotes = votingData.userVotes.map((vote) =>
      vote.topicIndex === topicIndex ? { ...vote, choice } : vote,
    )
    const updatedVotingData = {
      ...votingData,
      userVotes: newUserVotes,
    }

    setVotingData(updatedVotingData)
    saveDraftData('הצבעה', updatedVotingData)
  }

  const handleVoteReasonChange = (topicIndex: number, voteReason: string) => {
    // Convert empty string to undefined to match the checksum logic
    const normalizedVoteReason = voteReason?.trim() === '' ? undefined : voteReason

    const newUserVotes = votingData.userVotes.map((vote) =>
      vote.topicIndex === topicIndex ? { ...vote, voteReason: normalizedVoteReason } : vote,
    )
    const updatedVotingData = {
      ...votingData,
      userVotes: newUserVotes,
    }

    setVotingData(updatedVotingData)
    saveDraftData('נימוק הצבעה', updatedVotingData)
  }

  const handleNotesChange = () => {
    if (votingData.voterNotes !== localVoterNotes) {
      const updatedVotingData = { ...votingData, voterNotes: localVoterNotes }
      setVotingData(updatedVotingData)
      saveDraftData('הערות המצביע', updatedVotingData)
    }
  }

  const handleDynamicQuestionChange = useCallback(
    (questionId: string, answer: boolean, explanation?: string) => {
      const newDynamicQuestions = (votingData.dynamicQuestions || []).map((q) =>
        q.questionId === questionId ? { ...q, answer, explanation: explanation || '' } : q,
      )

      const updatedVotingData = {
        ...votingData,
        dynamicQuestions: newDynamicQuestions,
      }

      setVotingData(updatedVotingData)
      // Save draft data and trigger re-fetch to update fetchedAllLatestVotes
      saveDraftData('שאלה', updatedVotingData)
    },
    [votingData, saveDraftData],
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      if (filesArray.length === 0) return

      setIsUploading(true)
      try {
        const uploadPromises = filesArray.map((file) => {
          // Remove special characters from filename (keep alphanumeric, dot, dash, underscore, space)
          // Allow Hebrew, English letters, numbers, dot, dash, underscore, space
          const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.\-_ \u0590-\u05FF]/g, '')
          // Create a new File object with the sanitized filename
          const sanitizedFile =
            sanitizedFilename === file.name
              ? file
              : new File([file], sanitizedFilename, { type: file.type })

          const formData = new FormData()
          formData.append('file', sanitizedFile)
          return fetch('/api/documents', {
            method: 'POST',
            body: formData,
          })
            .then((res) => {
              if (!res.ok) {
                // Get error details if possible
                return res.text().then((errText) => {
                  throw new Error(errText || 'File upload failed')
                })
              }
              return res.json()
            })
            .catch((err) => {
              // Log each individual file upload error
              handleApiError(err, `שגיאה בהעלאת קובץ: ${sanitizedFilename}`)
              throw err
            })
        })

        const results = await Promise.all(uploadPromises)
        const newDocs = results.map((result) => result.doc)

        const updatedDocs = [...uploadedDocs, ...newDocs]
        setUploadedDocs(updatedDocs)

        const updatedVotingData = {
          ...votingData,
          voteDocuments: updatedDocs.map((d) => d.id),
        }
        setVotingData(updatedVotingData)
        saveDraftData('קובץ', updatedVotingData)
      } catch (error) {
        // Log the error with our utility
        handleApiError(error, 'שגיאה בהעלאת קבצים')
      } finally {
        setIsUploading(false)
        e.target.value = ''
      }
    }
  }

  const removeFile = (docIdToRemove: string) => {
    const newDocs = uploadedDocs.filter((doc) => doc.id !== docIdToRemove)
    setUploadedDocs(newDocs)

    const updatedVotingData = {
      ...votingData,
      voteDocuments: newDocs.map((d) => d.id),
    }
    setVotingData(updatedVotingData)
    saveDraftData('עדכון קבצים', updatedVotingData)
  }

  return (
    <>
      {/* Navigation Guard Dialog */}
      <Dialog open={navGuard.active}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="flex flex-row items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 flex-shrink-0" />
            <DialogTitle className="text-xl text-amber-600 m-0">שינויים ישמרו כטיוטה</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p>טיוטה לא נשלחת למנהלי המערכת. אם ברצונך לשלוח את השינוים יש ללחוץ על שלח הצבעה</p>
          </div>

          <DialogFooter className="flex justify-center gap-3 mt-6">
            <Button variant="outline" onClick={navGuard.reject}>
              חזור לדף הצבעה
            </Button>
            <Button variant="destructive" onClick={navGuard.accept}>
              השאר כטיוטה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {meetingData && !isMeetingLoading && !isSWRLoading ? (
        <div className="w-full mx-auto py-6 px-4 sm:px-6 lg:px-8 rtl">
          <VoteHeader
            meetingData={{
              meetingInviteUrl: meetingData.meetingInviteUrl,
              meetingType: meetingData.meetingType,
              stockName:
                meetingData.stockName && meetingData.stockNumber
                  ? `${meetingData.stockName} (${meetingData.stockNumber})`
                  : meetingData.stockName || meetingData.stockNumber || '',
            }}
            isReadOnly={isReadOnly}
            readOnlyReason={readOnlyReason}
            isDirty={isDirty}
            lastPublishedVoteInfo={lastPublishedVoteInfo}
            fetchedVotes={fetchedVotes}
            isReported={reported}
            approvalDoc={reportApproval}
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
                  dynamicQuestions={
                    meetingData.relatedQuestions &&
                    meetingData.relatedQuestions.questions &&
                    meetingData.relatedQuestions.questions.length > 0
                      ? votingData.dynamicQuestions?.map((dq) => {
                          const questionDef = meetingData.relatedQuestions?.questions?.find(
                            (q) => q.id === dq.questionId,
                          )
                          return {
                            id: dq.questionId,
                            questionText: questionDef?.questionText || '',
                            answer: dq.answer,
                            explanation: dq.explanation,
                          }
                        })
                      : undefined
                  }
                  onDynamicQuestionChange={
                    meetingData.relatedQuestions &&
                    meetingData.relatedQuestions.questions &&
                    meetingData.relatedQuestions.questions.length > 0
                      ? handleDynamicQuestionChange
                      : undefined
                  }
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
                              <span
                                className={`text-primary font-bold ml-2 mt-0.5 min-w-[24px] ${isReadOnly && 'text-primary/70'}  `}
                              >
                                {itemNumber}.
                              </span>
                              <div className={`flex-1 ${isHebrew ? 'text-right' : 'text-left'}`}>
                                <p
                                  className={`text-foreground font-medium ${
                                    item.isRemovedFromAgenda
                                      ? 'line-through text-muted-foreground'
                                      : ''
                                  } ${isReadOnly && 'text-primary/70'}`}
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
                                  דרוש רוב מיוחד
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
                                dir="rtl"
                                aria-label="בחר אפשרות הצבעה"
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
                                    className="py-2 px-4 text-right text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 transition-colors duration-150"
                                  >
                                    בעד
                                  </SelectItem>
                                  <SelectItem
                                    value="נגד"
                                    className="py-2 px-4 text-right text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition-colors duration-150"
                                  >
                                    נגד
                                  </SelectItem>
                                  <SelectItem
                                    value="נמנע"
                                    className="py-2 px-4 text-right text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                                  >
                                    נמנע
                                  </SelectItem>
                                  <SelectItem
                                    value="דיון"
                                    className="py-2 px-4 text-right text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                                  >
                                    דיון
                                  </SelectItem>
                                  <SelectItem
                                    value="אין חובת השתתפות"
                                    className="py-2 px-4 text-right text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                                  >
                                    אין חובת השתתפות
                                  </SelectItem>
                                  <SelectItem
                                    value="לא משתתף"
                                    className="py-2 px-4 text-right text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                                  >
                                    לא משתתף
                                  </SelectItem>
                                  <SelectItem
                                    value="----"
                                    className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                                  >
                                    ----
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <VoteReason
                                voteReason={userVote?.voteReason}
                                topicIndex={item.topicIndex}
                                onVoteReasonChangeAction={handleVoteReasonChange}
                                isReadOnly={isReadOnly}
                              />
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

                        {item.id !== meetingData.agendas[meetingData.agendas.length - 1].id && (
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
                        onClick={() => savePublish()}
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
      <PublishSuccessPopup isOpen={publishSuccess} onCloseAction={() => setPublishSuccess(false)} />
    </>
  )
}
