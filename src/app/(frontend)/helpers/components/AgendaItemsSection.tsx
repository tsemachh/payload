'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserVote, ValidationError, AgendaVotingIDs } from '../../types/vote'
import AgendaQuestions from '../../vote-meeting/components/AgendaQuestions'
import VoteReason from '../../vote-meeting/components/VoteReason'

interface AgendaItemsSectionProps {
  agendas: any[]
  userVotes: UserVote[]
  onVoteChange: (topicIndex: number, choice: UserVote['choice']) => void
  onVoteReasonChange: (topicIndex: number, voteReason: string) => void
  onAgendaQuestionsChange: (
    questionId: AgendaVotingIDs,
    value: boolean,
    explanation: string | undefined,
    topicIndex: number,
  ) => void
  getFieldError: (
    field: string,
    type: 'general' | 'agenda',
    topicIndex?: number,
  ) => ValidationError | undefined
  isReadOnly: boolean
  displayVotingRecommendation: boolean
}

export default function AgendaItemsSection({
  agendas,
  userVotes,
  onVoteChange,
  onVoteReasonChange,
  onAgendaQuestionsChange,
  getFieldError,
  isReadOnly,
  displayVotingRecommendation,
}: AgendaItemsSectionProps) {
  return (
    <div className="space-y-6">
      {agendas.map((item, index) => {
        const userVote = userVotes.find((v) => v.topicIndex == item.topicIndex)
        const choiceError = getFieldError('choice', 'agenda', item.topicIndex)
        const itemNumber = index + 1
        const isHebrew = /[\u0590-\u05FF]/.test(item.text)

        return (
          <div key={item.id} className={`${item.isRemovedFromAgenda ? 'opacity-70' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-4 pl-3 pr-3">
              <div>
                <div className="flex items-start">
                  <span
                    className={`text-primary font-bold ml-2 mt-0.5 min-w-[24px] ${isReadOnly && 'text-primary/70'}`}
                  >
                    {itemNumber}.
                  </span>
                  <div className={`flex-1 ${isHebrew ? 'text-right' : 'text-left'}`}>
                    <p
                      className={`text-foreground font-medium ${
                        item.isRemovedFromAgenda ? 'line-through text-muted-foreground' : ''
                      } ${isReadOnly && 'text-primary/70'}`}
                      dir={isHebrew ? 'rtl' : 'ltr'}
                    >
                      {item.text}
                    </p>
                  </div>
                </div>
                <div
                  className="flex flex-wrap gap-2 mt-2 mr-7"
                  style={{
                    justifyContent: isHebrew ? 'flex-start' : 'flex-end',
                  }}
                >
                  {item.privilegedMajority && !item.isRemovedFromAgenda && (
                    <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900">
                      דרוש רוב מיוחד
                    </span>
                  )}
                  {item.isRemovedFromAgenda && (
                    <span className="inline-block bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full border border-border">
                      הוסר מסדר היום
                    </span>
                  )}
                </div>
              </div>

              {!item.isRemovedFromAgenda && (
                <div className="flex flex-col items-center gap-2 min-w-[200px] border-r px-4  pl-0">
                  {item.recommendation.votingRecommendation && displayVotingRecommendation && (
                    <span
                      className={`inline-block text-xs px-2 py-1 rounded-full border w-full text-center ${
                        item.recommendation.votingRecommendation === 'בעד'
                          ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
                          : item.recommendation.votingRecommendation === 'נגד'
                            ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
                            : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900'
                      }`}
                    >
                      המלצה: {item.recommendation.votingRecommendation}
                    </span>
                  )}
                  <Select
                    value={userVote?.choice || undefined}
                    onValueChange={(value) =>
                      onVoteChange(item.topicIndex, value as UserVote['choice'])
                    }
                    disabled={isReadOnly}
                    dir="rtl"
                    aria-label="בחר אפשרות הצבעה"
                  >
                    <SelectTrigger
                      className={`w-full ${
                        choiceError
                          ? 'border-red-500 ring-1 ring-red-500'
                          : userVote?.choice === 'בעד'
                            ? 'border-green-500 bg-green-100 dark:bg-green-950 dark:border-green-800'
                            : userVote?.choice === 'נגד'
                              ? 'border-red-500 bg-red-100 dark:bg-red-950 dark:border-red-800'
                              : 'border-input'
                      }`}
                    >
                      <SelectValue placeholder="בחר הצבעה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="בעד"
                        className="py-2 px-4 text-right text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 transition-colors duration-150"
                      >
                        בעד
                      </SelectItem>
                      <SelectItem
                        value="נגד"
                        className="py-2 px-4 text-right text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition-colors duration-150"
                      >
                        נגד
                      </SelectItem>
                      <SelectItem
                        value="נמנע"
                        className="py-2 px-4 text-right text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                      >
                        נמנע
                      </SelectItem>
                      <SelectItem
                        value="דיון"
                        className="py-2 px-4 text-right text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                      >
                        דיון
                      </SelectItem>
                      <SelectItem
                        value="אין חובת השתתפות"
                        className="py-2 px-4 text-right text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                      >
                        אין חובת השתתפות
                      </SelectItem>
                      <SelectItem
                        value="לא משתתף"
                        className="py-2 px-4 text-right text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                      >
                        לא משתתף
                      </SelectItem>
                      <SelectItem
                        value="----"
                        className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                      >
                        ----
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <VoteReason
                    voteReason={userVote?.voteReason}
                    topicIndex={item.topicIndex}
                    onVoteReasonChangeAction={onVoteReasonChange}
                    isReadOnly={isReadOnly}
                  />
                </div>
              )}

              {!item.isRemovedFromAgenda && (
                <div className="border-r px-4 pl-0">
                  <AgendaQuestions
                    questions={
                      userVote?.questions || {
                        hasConflictOfInterest: false,
                        isRelatedParty: false,
                        isInvestmentCommittee: true,
                        hasPersonalInterest: false,
                      }
                    }
                    handleAgendaQuestionsChangeAction={(questionId, value, explanation) =>
                      onAgendaQuestionsChange(questionId, value, explanation, item.topicIndex)
                    }
                    getFieldErrorAction={getFieldError}
                    topicIndex={item.topicIndex}
                    isReadOnly={isReadOnly}
                  />
                </div>
              )}
            </div>

            {item.id !== agendas[agendas.length - 1].id && (
              <div className="mt-4 mb-2 border-b border-border" />
            )}
          </div>
        )
      })}
    </div>
  )
}
