import React, { Suspense } from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect, notFound } from 'next/navigation'
import { VotingForm } from './voting-form'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { SetStepNav } from '@payloadcms/ui'
import { getVoteData } from './api'
import { ErrorDisplay } from '@/app/(frontend)/components/ui/error-display'

async function VoteDataLoader({
  req,
  meetingId,
  parentCompanyId,
  checksum,
}: {
  req: any
  meetingId: string
  parentCompanyId: string
  checksum: string
}) {
  const voteData = await getVoteData(req, meetingId, parentCompanyId, checksum)

  if (voteData.error) {
    return <ErrorDisplay message={voteData.message} errors={voteData.errors} />
  }

  return <VotingForm voteData={voteData} meetingId={meetingId} />
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
  const parentCompanyId = (searchParams?.parentCompanyId || '') as string
  const checksum = (searchParams?.checksum || '') as string
  // Validate required parameters
  if (!meetingId) {
    notFound()
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
        <VoteDataLoader
          req={req}
          meetingId={meetingId}
          parentCompanyId={parentCompanyId}
          checksum={checksum}
        />
      </Suspense>
    </DefaultTemplate>
  )
}
export default GroupedVotesPage

