
import {
  getVotingRecommendationColor,
  isRTL,
} from '../helpers/utils-data-table'
import { AgendasType, MeetingTableDataType } from '../types/meetings'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import VotedCountStatus from '@/collections/meetings/components/VotedCountStatus'

export function AgendaTooltipWithNavigation({ row }: { row: MeetingTableDataType }) {
  const router = useRouter()

  const handleIconClick = () => {
    router.push(`/vote-meeting/${row.meetingIdPayload}`)
  }
  if (row.companies.length === 0) return null
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info
            className="w-4 h-4 text-blue-700 hover:text-blue-800 cursor-pointer"
            onClick={handleIconClick}
          />
        </TooltipTrigger>
        <TooltipContent
          className="rounded-md shadow-md border border-gray-200"
          side="left"
          sideOffset={30}
          align="end"
          alignOffset={30}
          avoidCollisions={true}
          collisionPadding={30}
        >
          <div
            style={{
              maxWidth: 'min(800px, calc(100vw - 240px))',
              maxHeight: 'calc(100vh - 140px)',
              overflow: 'auto',
              direction: 'rtl',
            }}
            className="flex flex-col gap-2"
          >
            {/* Vote Status */}
            <VotedCountStatus
              votingPercentage={row.votingPercentage}
              companiesNum={row.companies.length}
            />

            {/* Comments Section */}
            {row.comments && row.comments != '-' && (
              <div className="mt-1 text-right">
                <h4 className="font-bold text-base mb-1 text-right">הערות</h4>
                <p className="text-sm bg-gray-50 p-2 rounded-md text-right">{row.comments}</p>
              </div>
            )}

            {/* Agenda Items Table */}
            <div className="mt-1">
              <h4 className="font-bold text-base mb-1 text-right">נושאים לסדר היום</h4>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full border-collapse table-fixed">
                  <thead>
                    <tr className="bg-gray-100">
                      <th
                        className="py-2 px-2 border-b text-right font-medium text-gray-700"
                        style={{ width: '30px', minWidth: '30px' }}
                      ></th>
                      <th className="py-2 px-2 border-b text-center font-medium text-gray-700 text-[0.8rem]">
                        נושא ההצבעה
                      </th>
                      {row.displayVotingRecommendation && (
                        <th
                          className="py-2 px-2 border-b text-center font-medium text-gray-700 text-[0.8rem]"
                          style={{ width: '100px', minWidth: '100px' }}
                        >
                          המלצת הצבעה
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {row.agendas.length ? (
                      row.agendas.map((item: AgendasType, index: number) => (
                        <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td
                            className="py-1 px-2 border-t text-right"
                            style={{ width: '30px', minWidth: '30px' }}
                          >
                            {item.topicIndex}.
                          </td>
                          <td
                            className={`py-1 px-2 border-t ${isRTL(item.text) ? 'text-right' : 'text-left'}`}
                          >
                            <div
                              dir={isRTL(item.text) ? 'rtl' : 'ltr'}
                              style={{
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'break-word',
                                fontSize: '0.80rem',
                              }}
                            >
                              {item.text}
                            </div>
                          </td>
                          {row.displayVotingRecommendation && (
                            <td
                              className={`py-1 px-2 border-t text-right font-medium ${getVotingRecommendationColor(item.recommendation.votingRecommendation)}`}
                              style={{ width: '100px', minWidth: '100px' }}
                            >
                              {item.recommendation.votingRecommendation}
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-1 px-2 text-center">
                          אסיפה ללא נושא
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}