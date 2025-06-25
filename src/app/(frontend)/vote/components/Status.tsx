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
}

export default function VoteStatus({
  isPublished,
  publishedInfo,
  isDraft,
  draftInfo,
}: VoteStatusProps) {
  if ((isPublished && !publishedInfo) || (isDraft && !draftInfo)) {
    return null
  }

  if (isPublished && publishedInfo) {
    const relativeTime = getRelativeTime(publishedInfo.date)
    const tooltipText = `ההצבעה נשלחה על ידי ${publishedInfo.user} ${relativeTime}`

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help mx-1">
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
    const tooltipText = `עודכן ${relativeTime}`

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help mx-1">
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
