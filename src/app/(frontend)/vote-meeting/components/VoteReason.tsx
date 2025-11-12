'use client'
import { useEffect, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'

interface VoteReasonProps {
  voteReason?: string
  topicIndex: number
  onVoteReasonChangeAction: (topicIndex: number, voteReason: string) => void
  isReadOnly?: boolean
}

export default function VoteReason({
  voteReason,
  topicIndex,
  onVoteReasonChangeAction,
  isReadOnly = false,
}: VoteReasonProps) {
  const [isInputOpen, setIsInputOpen] = useState(false)
  const [localValue, setLocalValue] = useState(voteReason || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Update local value when voteReason prop changes
  useEffect(() => {
    setLocalValue(voteReason || '')
  }, [voteReason])

  const toggleInput = () => {
    setIsInputOpen((prev) => !prev)
  }

  const handleInputChange = (value: string) => {
    setLocalValue(value)
  }

  const handleBlur = () => {
    // Only call onVoteReasonChangeAction if the value has actually changed
    if (localValue !== voteReason) {
      onVoteReasonChangeAction(topicIndex, localValue)
    }
  }

  return (
    <div className="w-full">
      <span
        className={`self-start text-sm text-muted-foreground ${
          !isReadOnly ? 'cursor-pointer hover:underline' : 'cursor-default'
        }`}
        onClick={toggleInput}
      >
        נימוק הצבעה
      </span>
      {voteReason && !isInputOpen && (
        <div className="mt-1 p-2 bg-muted/30 rounded-md text-sm text-foreground w-[200px] whitespace-pre-wrap break-words">
          {voteReason}
        </div>
      )}
      {isInputOpen && (
        <div className="mt-2 w-[200px]">
          <Textarea
            ref={textareaRef}
            placeholder="הכנס נימוק להצבעה..."
            value={localValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleBlur}
            disabled={isReadOnly}
            className="text-sm resize-none overflow-hidden"
            rows={1}
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
