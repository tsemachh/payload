'use client'

import { FileCheck, FileEdit } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function getRelativeTime(date: string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / (1000 * 60))

  if (diffInMinutes < 60) {
    if (diffInMinutes === 0) {
      return 'לפני פחות מדקה'
    }
    if (diffInMinutes === 1) {
      return 'לפני דקה'
    }
    return `לפני ${diffInMinutes} דקות`
  }

  const hours = Math.floor(diffInMinutes / 60)
  if (hours < 24) {
    if (hours === 1) {
      return 'לפני שעה'
    }
    return `לפני ${hours} שעות`
  }

  const days = Math.floor(hours / 24)
  if (days === 1) {
    return 'לפני יום'
  }
  return `לפני ${days} ימים`
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
