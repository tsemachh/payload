'use client'

import { useState } from 'react'
import { FileCheck, FileEdit } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import moment from 'moment'
import 'moment/locale/he'

moment.locale('he')

function getRelativeTime(date: string | Date): string {
  return moment(date).fromNow()
}

interface VoteInfo {
  user: string
  date: string | Date
}

interface VoteStatusProps {
  isPublished: boolean
  publishedInfo?: VoteInfo
  isDraft: boolean
  draftInfo?: VoteInfo
  isFirstDraft: boolean
}

function StatusIconWithTooltip({
  info,
  isPublished,
  isFirstDraft,
}: {
  info: VoteInfo
  isPublished: boolean
  isFirstDraft?: boolean
}) {
  const [relativeTime, setRelativeTime] = useState(() => getRelativeTime(info.date))

  const handleHover = () => {
    setRelativeTime(getRelativeTime(info.date))
  }

  const isSystemUser = info.user === '' || info.user === 'system'
  const tooltipText = isPublished
    ? isSystemUser
      ? `ההצבעה נשלחה ${relativeTime}`
      : `ההצבעה נשלחה על ידי ${info.user} ${relativeTime}`
    : `טיוטה ${isFirstDraft ? 'נוספת' : ''} עודכנה ${relativeTime}`

  const IconComponent = isPublished ? FileCheck : FileEdit
  const colors = isPublished
    ? 'bg-green-100 border-green-200 text-green-600'
    : 'bg-orange-100 border-orange-200 text-orange-600'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild onMouseEnter={handleHover}>
          <div className="mx-1">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full border ${colors}`}
            >
              <IconComponent className="h-4 w-4" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="mx-3" side="bottom" align="start">
          <p className="text-sm">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function VoteStatus({
  isPublished,
  publishedInfo,
  isDraft,
  draftInfo,
  isFirstDraft,
}: VoteStatusProps) {
  if (isPublished && publishedInfo) {
    return <StatusIconWithTooltip info={publishedInfo} isPublished={true} />
  }

  if (isDraft && draftInfo) {
    return (
      <StatusIconWithTooltip info={draftInfo} isPublished={false} isFirstDraft={isFirstDraft} />
    )
  }

  return null
}