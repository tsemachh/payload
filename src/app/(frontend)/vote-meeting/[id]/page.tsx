'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useParams, useRouter } from 'next/navigation'
import { useNavigationGuard } from 'next-navigation-guard'
import { CompanyTableData } from '../../types/meetings'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import VoteDetails from '../components/VoteDetails'
import VoteCompanySelector from '../components/VoteCompanySelector'
import GeneralQuestions from '../components/GeneralQuestions'
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
import { PublishSuccessPopup } from '../components/PublishSuccessPopup'
import { Document } from '@/payload-types'
import VoteHeader from '../components/Header'
import { hasCompanyPermission } from '@/utils/permissions'
import { useAuth } from '@/providers/auth-provider'
import { useImpersonation } from '@/plugins/impersonate/components'
import { useCompaniesContext } from '../../context/companiesContext'
import {
  transformVoteToComparisonFormat,
  createInitialVoteData,
} from '../../helpers/vote-transformers'
import {
  validateGeneralQuestions,
  validateAgendaQuestions,
  validateVoteData,
} from '../../helpers/vote-validation'
import AgendaItemsSection from '../../helpers/components/AgendaItemsSection'
import VotingActions from '../../helpers/components/VotingActions'
import AttachmentsSection from '../../helpers/components/AttachmentsSection'
import NavigationGuardDialog from '../../helpers/components/NavigationGuardDialog'

export default function VotingForm() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { companies: companiesFromContext } = useCompaniesContext()

  useEffect(() => {
    if (user === null) {
      const currentPath = window.location.pathname + window.location.search
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(currentPath)}`)
      return
    }
  }, [user, router])

  const meetingIdFromUrl = params?.id || '-'

  const [isReadOnly, setIsReadOnly] = useState(false)
  const [readOnlyReason, setReadOnlyReason] = useState<'date' | 'permission' | null>(null)
  const [uploadedDocs, setUploadedDocs] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const [localVoterNotes, setLocalVoterNotes] = useState<string>('')
  const [companiesIDs, setCompaniesIDs] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittingAction, setSubmittingAction] = useState<'single' | 'all' | null>(null)
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
  const [publishSuccessAll, setPublishSuccessAll] = useState<{
    updatedCount: number
    companyNames: string[]
    isPrivateVote: boolean
  }>({ updatedCount: 0, companyNames: [], isPrivateVote: false })
  const [isDraftSaved, setIsDraftSaved] = useState(false)
  const [companiesWithErrors, setCompaniesWithErrors] = useState<Set<string>>(new Set())

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
    if (!initialVotingData || !fetchedVotes || fetchedVotes.length === 0) {
      return true
    }

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

  // SWR For the review, check if there is a draft for sending for all companies.
  const swrKeyAllPublished =
    meetingIdPayload && meetingCompanies.length > 0
      ? `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${meetingCompanies}&status=published`
      : null

  const { data: fetchedAllPublishedVotes, mutate: mutateAllPublishedVotes } = useSWR(
    swrKeyAllPublished,
    fetcherVote,
    {
      revalidateOnFocus: false,
    },
  )

  const isAnyCompanyDirty = useMemo(() => {
    if (isDirty) return true
    if (!fetchedAllLatestVotes || !fetchedAllPublishedVotes || !meetingCompanies) return false

    const numCompanies = meetingCompanies.length
    const numPublished = fetchedAllPublishedVotes.length

    if (numPublished < numCompanies) return true

    // Full comparison for each company
    for (const latestVote of fetchedAllLatestVotes) {
      const companyId =
        typeof latestVote.company === 'string' ? latestVote.company : latestVote.company?.id

      const publishedVote = fetchedAllPublishedVotes.find((pv: any) => {
        const pvCompanyId = typeof pv.company === 'string' ? pv.company : pv.company?.id
        return pvCompanyId === companyId
      })

      if (!publishedVote) continue

      const latestForComparison = transformVoteToComparisonFormat(latestVote)
      const publishedForComparison = transformVoteToComparisonFormat(publishedVote)

      if (JSON.stringify(latestForComparison) !== JSON.stringify(publishedForComparison)) {
        return true
      }
    }

    return false
  }, [isDirty, fetchedAllLatestVotes, fetchedAllPublishedVotes, meetingCompanies])

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

    const {
      initialData,
      publishedData,
      uploadedDocs: docs,
      lastPublishedVoteInfo: info,
    } = createInitialVoteData(meetingData, fetchedVotes, publishedVotes)

    setVotingData(initialData)
    setInitialVotingData(publishedData ? structuredClone(publishedData) : null)
    setUploadedDocs(docs)
    setLastPublishedVoteInfo(info)
  }, [fetchedVotes, isSWRLoading, meetingData, isMeetingLoading, publishedVotes, setIsDraftSaved])

  useEffect(() => {
    setLocalVoterNotes(votingData.voterNotes || '')
  }, [votingData.voterNotes])

  // Use navigation guard hook for back button and browser navigation
  const navGuard = useNavigationGuard({
    enabled: (isAnyCompanyDirty || isDraftSaved) && !isReadOnly,
  })

  const validateForm = useCallback((): ValidationError[] => {
    const hasDynamicQuestions =
      meetingData?.relatedQuestions &&
      meetingData.relatedQuestions.questions &&
      meetingData.relatedQuestions.questions.length > 0

    return [
      ...validateGeneralQuestions(votingData, hasDynamicQuestions || false),
      ...validateAgendaQuestions(votingData, meetingData),
    ]
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

  const validateAllCompaniesVotes = useCallback(async (): Promise<{
    isValid: boolean
    invalidCompanies: string[]
  }> => {
    if (!meetingIdPayload || !meetingCompanies.length || !meetingData) {
      return { isValid: false, invalidCompanies: [] }
    }

    try {
      // Fetch all draft votes for all companies
      const response = await fetch(
        `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${meetingCompanies}&status=draft`,
      )
      const allVotes = await response.json()

      const invalidCompanies: string[] = []

      // Check if we have dynamic questions
      const hasDynamicQuestions =
        meetingData?.relatedQuestions &&
        meetingData.relatedQuestions.questions &&
        meetingData.relatedQuestions.questions.length > 0

      // Check if all companies have draft votes
      for (const companyId of meetingCompanies) {
        const vote = allVotes.find(
          (v: any) => (typeof v.company === 'string' ? v.company : v.company?.id) === companyId,
        )

        if (!vote) {
          // invalidCompanies.push(companyId)
          continue
        }

        if (!validateVoteData(meetingData, vote, hasDynamicQuestions || false)) {
          invalidCompanies.push(companyId)
        }
      }

      return {
        isValid: invalidCompanies.length === 0,
        invalidCompanies,
      }
    } catch (error) {
      console.error('Error validating all companies votes:', error)
      return { isValid: false, invalidCompanies: [] }
    }
  }, [meetingIdPayload, meetingCompanies, meetingData])

  // When switching to a company with errors, validate and show field errors
  useEffect(() => {
    if (companiesWithErrors.size > 0 && companiesIDs.length === 1) {
      const currentCompanyId = companiesIDs[0]

      if (companiesWithErrors.has(currentCompanyId)) {
        if (!meetingData || !votingData) {
          return
        }

        const errors = validateForm()
        if (errors.length > 0) {
          setValidationErrors(errors)
        } else {
          // Company was marked as having errors but now it's valid - remove from error set
          setCompaniesWithErrors((prev) => {
            const newSet = new Set(prev)
            newSet.delete(companiesIDs[0])
            return newSet
          })
        }
      } else {
        // Switched to a company without errors - clear field errors
        setValidationErrors([])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votingData, companiesWithErrors, validateForm])

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
      } else {
        setValidationErrors([])
      }

      setIsSubmitting(true)
      setSubmittingAction('single')

      try {
        const response = await postWithErrorHandling(
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

        // Determine if this is a private vote (single company)
        const isPrivate = companiesIDs.length === 1

        // Resolve company IDs to names from companiesContext
        const companyNames = (response.updatedCompanyIds || [])
          .map((id: string) => {
            const company = companiesFromContext.find((c) => c.id === id)
            return company?.name || null
          })
          .filter((name: string | null): name is string => name !== null)

        // Set success data for popup
        setPublishSuccessAll({
          updatedCount: response.actuallyUpdated || 0,
          companyNames,
          isPrivateVote: isPrivate,
        })

        setPublishSuccess(true)
        mutatePublish()
        mutateAllLatestVotes()
        mutateVotedCompaniesArray()
        mutateAllPublishedVotes()
      } catch (_error) {
        // Error already logged and notified by postWithErrorHandling
        // Additional error handling if needed
      } finally {
        setIsSubmitting(false)
        setSubmittingAction(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      votingData,
      validateForm,
      meetingIdPayload,
      companiesIDs,
      companiesFromContext,
      toast,
      router,
      mutatePublish,
      mutateAllLatestVotes,
      mutateVotedCompaniesArray,
    ],
  )

  const createMissingDrafts = useCallback(async () => {
    if (!meetingData || !meetingIdPayload || !meetingCompanies.length) return

    const response = await fetch(
      `/api/votes/by-meeting-and-companies?meetingId=${meetingIdPayload}&companiesIds=${meetingCompanies.join(',')}&status=draft`,
    )
    const existingDrafts = await response.json()

    const companiesWithDraft = new Set(
      existingDrafts.map((vote: any) =>
        typeof vote.company === 'string' ? vote.company : vote.company?.id,
      ),
    )

    const missingCompanies = meetingCompanies.filter(
      (companyId: string) => !companiesWithDraft.has(companyId),
    )

    if (missingCompanies.length === 0) return

    const dynamicQuestions: DynamicQuestionAnswer[] = meetingData.relatedQuestions?.questions
      ? meetingData.relatedQuestions.questions.map((q) => ({
          questionId: q.id,
          questionText: q.questionText,
          answer: q.defaultValue || false,
          explanation: '',
        }))
      : []

    const defaultVotingData: VoteDataType = {
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

    await postWithErrorHandling(
      '/api/votes/upsert-draft',
      {
        meetingId: meetingIdPayload,
        companiesIds: missingCompanies,
        votingData: defaultVotingData,
      },
      {
        errorMessage: 'שגיאה ביצירת טיוטות לחברות חסרות',
      },
    )

    mutateAllLatestVotes()
    mutateDraft()
  }, [meetingData, meetingIdPayload, meetingCompanies, mutateAllLatestVotes, mutateDraft])

  const savePublishAll = useCallback(async () => {
    // Trigger blur on all textareas to ensure all changes are saved
    const textareas = document.querySelectorAll('textarea')
    textareas.forEach((textarea) => {
      if (textarea === document.activeElement) {
        textarea.blur()
      }
    })
    await new Promise((resolve) => setTimeout(resolve, 100))

    await createMissingDrafts()

    const validationResult = await validateAllCompaniesVotes()
    if (!validationResult.isValid) {
      // Set companies with errors
      setCompaniesWithErrors(new Set(validationResult.invalidCompanies))

      // If current company is in the invalid list, show field-level errors
      if (validationResult.invalidCompanies.includes(companiesIDs[0])) {
        const currentErrors = validateForm()
        if (currentErrors.length > 0) {
          setValidationErrors(currentErrors)
          // Scroll to the first error
          const firstError = currentErrors[0]
          const errorElement = document.querySelector(
            `[data-field-name="${firstError.field}"][data-topic-index="${firstError.topicIndex || ''}"]`,
          )
          errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } else {
        setValidationErrors([])
      }

      setTimeout(() => {
        toast({
          title: '⚠️  חברות עם שדות חובה חסרים',
          description: `לא ניתן לשלוח הצבעות. נמצאו ${validationResult.invalidCompanies.length} חברות עם שדות חובה חסרים (מסומנות באדום). אנא השלם את השדות החובה בכל החברות.`,
          duration: 5000,
        })
      }, 0)
      return
    }

    setCompaniesWithErrors(new Set())
    setValidationErrors([])
    setIsSubmitting(true)
    setSubmittingAction('all')
    try {
      const response = await postWithErrorHandling(
        '/api/votes/publish-votes',
        {
          meetingId: meetingIdPayload,
          companiesIds: meetingCompanies,
        },
        { errorMessage: 'שגיאה בשליחת ההצבעה' },
      )

      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Resolve company IDs to names from companiesContext
      const companyNames = (response.updatedCompanyIds || [])
        .map((id: string) => {
          const company = companiesFromContext.find((c) => c.id === id)
          return company?.name || null
        })
        .filter((name: string | null): name is string => name !== null)

      setPublishSuccessAll({
        updatedCount: response.actuallyUpdated || 0,
        companyNames,
        isPrivateVote: false,
      })
      setPublishSuccess(true)
      mutatePublish()
      mutateAllLatestVotes()
      mutateVotedCompaniesArray()
      mutateAllPublishedVotes()
    } catch (_error) {
    } finally {
      setIsSubmitting(false)
      setSubmittingAction(null)
    }
  }, [
    createMissingDrafts,
    validateAllCompaniesVotes,
    validateForm,
    meetingIdPayload,
    meetingCompanies,
    companiesIDs,
    companiesFromContext,
    toast,
    mutatePublish,
    mutateAllLatestVotes,
    mutateVotedCompaniesArray,
    mutateAllPublishedVotes,
  ])

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

  if (user === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinnerDiamond />
      </div>
    )
  }

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
                  companiesWithErrors={companiesWithErrors}
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
                <AgendaItemsSection
                  agendas={meetingData.agendas}
                  userVotes={votingData.userVotes}
                  isReadOnly={isReadOnly}
                  displayVotingRecommendation={meetingData?.displayVotingRecommendation}
                  onVoteChange={handleVoteChange}
                  onVoteReasonChange={handleVoteReasonChange}
                  onAgendaQuestionsChange={handleAgendaQuestionsChangeWrapper}
                  getFieldError={getFieldError}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-primary/10 py-1.5 px-3">
                <h2 className="text-sm font-medium text-primary">נספחים להצבעה</h2>
              </CardHeader>
              <CardContent className="p-4">
                <AttachmentsSection
                  localVoterNotes={localVoterNotes}
                  onNotesChange={setLocalVoterNotes}
                  onNotesBlur={handleNotesChange}
                  uploadedDocs={uploadedDocs}
                  onFileChange={handleFileChange}
                  onRemoveFile={removeFile}
                  isUploading={isUploading}
                  isReadOnly={isReadOnly}
                />
              </CardContent>
            </Card>

            {/* כפתורי שליחת הצבעה */}
            <div className="flex justify-end gap-4 mt-6">
              <VotingActions
                meetingCompanies={meetingCompanies}
                isGeneralVoteOption={isGeneralVoteOption}
                isDirty={isDirty}
                isAnyCompanyDirty={isAnyCompanyDirty}
                isSubmitting={isSubmitting}
                isUploading={isUploading}
                isReadOnly={isReadOnly}
                submittingAction={submittingAction}
                onSavePublish={savePublish}
                onSavePublishAll={savePublishAll}
              />
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
      <PublishSuccessPopup
        isOpen={publishSuccess}
        onCloseAction={() => setPublishSuccess(false)}
        updatedCount={publishSuccessAll.updatedCount}
        companyNames={publishSuccessAll.companyNames}
        isPrivateVote={publishSuccessAll.isPrivateVote}
      />
      <NavigationGuardDialog navGuard={navGuard} />
    </>
  )
}
