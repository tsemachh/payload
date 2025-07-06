import { Vote } from '@/payload-types'
import VoteStatus from './Status'

interface MeetingHeaderProps {
  meetingData: {
    meetingInviteUrl?: string
    meetingType: string
    stockName: string
  }
  isReadOnly: boolean
  isDirty: boolean
  lastPublishedVoteInfo: { user: string; date: Date } | undefined
  fetchedVotes: Vote[]
}

const VoteHeader = ({
  meetingData,
  isReadOnly,
  isDirty,
  lastPublishedVoteInfo,
  fetchedVotes,
}: MeetingHeaderProps) => {
  return (
    <div className="w-full mx-auto py-6 px-4 sm:px-6 lg:px-8 rtl">
      <div className="mb-3 mt-[-20px]">
        <div className="flex flex-row flex-wrap items-center justify-center gap-2 text-center relative">
          <div className="w-full md:w-auto">
            {meetingData.meetingInviteUrl ? (
              <a
                href={meetingData.meetingInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center text-2xl font-bold text-blue-700 hover:text-blue-800 hover:underline transition-colors"
              >
                אסיפה {meetingData.meetingType} - {meetingData.stockName}
              </a>
            ) : (
              <div className="text-2xl font-bold">
                אסיפה {meetingData.meetingType} - {meetingData.stockName}
              </div>
            )}
          </div>

          <VoteStatus
            isPublished={!isDirty}
            publishedInfo={lastPublishedVoteInfo}
            isFirstDraft={!!lastPublishedVoteInfo}
            isDraft={fetchedVotes?.length > 0 && isDirty}
            draftInfo={
              fetchedVotes?.length > 0 && fetchedVotes[0].updatedAt != ''
                ? {
                    user: 'לא ידוע',
                    date: fetchedVotes[0].updatedAt,
                  }
                : undefined
            }
          />
        </div>
        {isReadOnly && (
          <div className="text-center mt-2">
            <div className="text-lg font-semibold text-gray-800">האסיפה נעולה להצבעה</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VoteHeader
