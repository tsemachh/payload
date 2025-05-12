'use client'

import { GeneralVotingData } from '../../types/meetings'

interface GeneralQuestionsProps {
  generalVotingData: GeneralVotingData
  onQuestionChange: (
    question: 'isInterested' | 'isSeniorOfficial' | 'isInstitutionalInvestor',
    value: boolean,
  ) => void
}

export default function GeneralQuestions({
  generalVotingData,
  onQuestionChange,
}: GeneralQuestionsProps) {
  return (
    <>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center">
          <span className="text-sm font-medium ml-2">האם הינך בעל עניין?</span>
          <div className="flex bg-muted rounded-full p-0.5 mr-2">
            <button
              type="button"
              onClick={() => onQuestionChange('isInterested', true)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                generalVotingData.isInterested === true
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              כן
            </button>
            <button
              type="button"
              onClick={() => onQuestionChange('isInterested', false)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                generalVotingData.isInterested === false
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              לא
            </button>
          </div>
        </div>

        <div className="flex items-center">
          <span className="text-sm font-medium ml-2">האם הינך נושא משרה בכירה?</span>
          <div className="flex bg-muted rounded-full p-0.5 mr-2">
            <button
              type="button"
              onClick={() => onQuestionChange('isSeniorOfficial', true)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                generalVotingData.isSeniorOfficial === true
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              כן
            </button>
            <button
              type="button"
              onClick={() => onQuestionChange('isSeniorOfficial', false)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                generalVotingData.isSeniorOfficial === false
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              לא
            </button>
          </div>
        </div>

        <div className="flex items-center">
          <span className="text-sm font-medium ml-2">האם הינך משקיע מוסדי?</span>
          <div className="flex bg-muted rounded-full p-0.5 mr-2">
            <button
              type="button"
              onClick={() => onQuestionChange('isInstitutionalInvestor', true)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                generalVotingData.isInstitutionalInvestor === true
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              כן
            </button>
            <button
              type="button"
              onClick={() => onQuestionChange('isInstitutionalInvestor', false)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                generalVotingData.isInstitutionalInvestor === false
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              לא
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
