import React, { Suspense } from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { VotingForm } from './voting-form'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { SetStepNav } from '@payloadcms/ui'
import { getVoteData } from './api'

async function VoteDataLoader({
  req,
  meetingId,
  companyIds,
}: {
  req: any
  meetingId: string
  companyIds: string
}) {
  const voteData = await getVoteData(req, meetingId, companyIds)
  return <VotingForm voteData={voteData} meetingId={meetingId} companyIds={companyIds} />
}

const GroupedVotesPage = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const {
    permissions,
    req,
    req: {
      payload,
      payload: {
        config: {
          routes: { admin: adminRoute },
        },
      },
      user,
    },
    visibleEntities,
  } = initPageResult

  // Optional: Redirect unauthorized users
  if (!user || (user && !permissions?.canAccessAdmin)) {
    return redirect(`${adminRoute}/unauthorized`)
  }

  const meetingId = (searchParams?.meetingId || '') as string
  const companyIds = (searchParams?.companyIds || '') as string

  // Validate required parameters
  if (!meetingId) {
    throw new Error('אסיפה לא קימת במערכת')
  }

  // Get meeting name for header
  const meetingData = await payload.findByID({
    collection: 'meetings',
    id: meetingId,
    select: {
      fullName: true,
    },
    depth: 0,
  })

  // Loading component for Suspense fallback
  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-[400px] space-y-4">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-600 dark:text-gray-400">טוען נתוני הצבעה...</p>
      </div>
    </div>
  )

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <SetStepNav
        nav={[
          { label: 'אסיפות', url: `${adminRoute}/collections/meetings` },
          {
            label: (
              <Link
                href={`${adminRoute}/collections/meetings/${meetingId}`}
                title="Navigate to Meeting"
              >
                {meetingData.fullName || 'Meeting'}
              </Link>
            ),
            url: `${adminRoute}/collections/meetings/${meetingId}`,
          },
        ]}
      />
      <Suspense fallback={<LoadingFallback />}>
        <VoteDataLoader req={req} meetingId={meetingId} companyIds={companyIds} />
      </Suspense>
    </DefaultTemplate>
  )
}
export default GroupedVotesPage
