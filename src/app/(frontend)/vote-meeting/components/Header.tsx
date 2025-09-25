import { Vote } from '@/payload-types'
import VoteStatus from './Status'
import { Lock } from 'lucide-react'

interface MeetingHeaderProps {
  meetingData: {
    meetingInviteUrl?: string
    meetingType: string
    stockName: string
  }
  isReadOnly: boolean
  readOnlyReason?: 'date' | 'permission' | null
  isDirty: boolean
  lastPublishedVoteInfo: { user: string; date: Date } | undefined
  fetchedVotes: Vote[]
  isReported: boolean
  approvalDoc?: {
    url: string
    filename: string
    mimeType?: string
  }
}

const VoteHeader = ({
  meetingData,
  isReadOnly,
  readOnlyReason,
  isDirty,
  lastPublishedVoteInfo,
  fetchedVotes,
  isReported,
  approvalDoc
}: MeetingHeaderProps) => {
  console.log("approvalDoc @@@@",approvalDoc)
  return (
    <div className="w-full mx-auto py-6 px-4 sm:px-6 lg:px-8 rtl">
      <div className="mb-3 mt-[-30px]">
        {isReadOnly && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg px-4 py-3">
            <div className="flex flex-col items-center justify-center space-y-2">
              <Lock className="w-6 h-6 text-gray-600" />
              <div className="text-sm font-medium text-gray-800 text-center whitespace-nowrap">
                {readOnlyReason === 'permission' 
                  ? 'אין לך הרשאות להצביע באסיפה זו'
                  : 'האסיפה נעולה להצבעה'}
              </div>
            </div>
          </div>
        )}

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
            draftInfo={fetchedVotes?.length > 0 && fetchedVotes[0].updatedAt != ''
              ? {
                user: 'לא ידוע',
                date: fetchedVotes[0].updatedAt,
              }
              : undefined}
            isReported={isReported}         
          />
          
           {/* Download button for the approval doc */}
           { approvalDoc?.url && (
            <a
              href={approvalDoc?.url}
              download={approvalDoc?.filename || 'approval.xlsx'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              הורד אישור הצבעה
            </a>
          )}

        </div>
      </div>
    </div>
  )
}

export default VoteHeader
