'use client'

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

export default function VoteStatus({
  isPublished,
  publishedInfo,
  isDraft,
  draftInfo,
  isFirstDraft,
}: VoteStatusProps) {
  if ((isPublished && !publishedInfo) || (isDraft && !draftInfo)) {
    return null
  }

  if (isPublished && publishedInfo) {
    const relativeTime = getRelativeTime(publishedInfo.date)
    const tooltipText =
      publishedInfo.user === ''
        ? `ההצבעה נשלחה ${relativeTime}`
        : `ההצבעה נשלחה על ידי ${publishedInfo.user} ${relativeTime}`

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mx-1">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full border border-green-200">
                <FileCheck className="h-4 w-4 text-green-600" />
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

  if (isDraft && draftInfo) {
    const relativeTime = getRelativeTime(draftInfo.date)
    const tooltipText = `טיוטה ${isFirstDraft ? 'נוספת' : ''} עודכנה ${relativeTime}`

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mx-1">
              <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full border border-orange-200">
                <FileEdit className="h-4 w-4 text-orange-600" />
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

  return null
}
