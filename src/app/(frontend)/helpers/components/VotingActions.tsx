'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface VotingActionsProps {
  meetingCompanies: any[]
  isGeneralVoteOption: boolean
  isDirty: boolean
  isAnyCompanyDirty: boolean
  isSubmitting: boolean
  submittingAction: 'single' | 'all' | null
  isUploading: boolean
  isReadOnly: boolean
  onSavePublish: () => void
  onSavePublishAll: () => void
}

export default function VotingActions({
  meetingCompanies,
  isGeneralVoteOption,
  isDirty,
  isAnyCompanyDirty,
  isSubmitting,
  submittingAction,
  isUploading,
  isReadOnly,
  onSavePublish,
  onSavePublishAll,
}: VotingActionsProps) {
  if (meetingCompanies.length === 1 || isGeneralVoteOption) {
    return (
      /* Single button for single company */
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                onClick={() => onSavePublish()}
                disabled={!isDirty || isSubmitting || isUploading || isReadOnly}
                className="px-8"
              >
                {isSubmitting ? 'שולח...' : 'שליחת ההצבעה'}
              </Button>
            </div>
          </TooltipTrigger>
          {(!isDirty || isSubmitting || isUploading || isReadOnly) && (
            <TooltipContent className="m-1 mx-3">
              {!isDirty
                ? 'אין שינוי מההצבעה שנשלחה לעמדה'
                : isUploading
                  ? 'אנא המתן לסיום העלאת הקבצים'
                  : isReadOnly
                    ? 'זמן ההצבעה עבר, אין אפשרות לשלוח הצבעה'
                    : 'הצבעה נשלחת, אנא המתן'}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      {/* Button for current selection (general or private) */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                onClick={() => onSavePublish()}
                disabled={!isDirty || isSubmitting || isUploading || isReadOnly}
                className="px-8"
              >
                {submittingAction === 'single' ? 'שולח...' : 'שליחת ההצבעה'}
              </Button>
            </div>
          </TooltipTrigger>
          {(!isDirty || isSubmitting || isUploading || isReadOnly) && (
            <TooltipContent className="m-1 mx-3">
              {!isDirty
                ? 'אין שינוי מההצבעה שנשלחה לעמדה עבור החברה הנוכחית'
                : isUploading
                  ? 'אנא המתן לסיום העלאת הקבצים'
                  : isReadOnly
                    ? 'זמן ההצבעה עבר, אין אפשרות לשלוח הצבעה'
                    : 'הצבעה נשלחת, אנא המתן'}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Button to send ALL votes */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="ml-2">
              <Button
                onClick={() => onSavePublishAll()}
                disabled={!isAnyCompanyDirty || isSubmitting || isUploading || isReadOnly}
                className="px-8 border border-gray-300 dark:border-gray-600"
                variant="secondary"
              >
                {submittingAction === 'all' ? 'שולח...' : 'שליחת כל ההצבעות'}
              </Button>
            </div>
          </TooltipTrigger>
          {(!isAnyCompanyDirty || isSubmitting || isUploading || isReadOnly) && (
            <TooltipContent className="m-1 mx-3">
              {!isAnyCompanyDirty
                ? 'כל ההצבעות כבר נשלחו'
                : isUploading
                  ? 'אנא המתן לסיום העלאת הקבצים'
                  : isReadOnly
                    ? 'זמן ההצבעה עבר, אין אפשרות לשלוח הצבעה'
                    : 'הצבעה נשלחת, אנא המתן'}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </>
  )
}
