'use client'

import type React from 'react'
import { cn } from '@/lib/utils'
import { formatDateTime, parseNumber } from '../helpers/utils-data-table'
import type { Column } from '../types/meetings'
import { BooleanIcon } from '@/components/ui/icons'
import type { ParticipationTableDataType } from './types'
import { resultMapping } from '@/lib/exportTypes'
import { formatNumberWithLocale } from '@/utils/numberUtils'

export const createParticipationColumns = (
  selectedCompaniesCount: number,
  allSelected: boolean,
  participationData: ParticipationTableDataType[],
  deselectedIds: Set<string>,
  setDeselectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
): Column<ParticipationTableDataType>[] => {
  const baseColumns: Column<ParticipationTableDataType>[] = [
    // Uncomment if you want to enable selection
    // {
    //   key: 'select',
    //   header: 'בחר הכל',
    //   type: 'boolean',
    //   minWidth: 25,
    //   positionCenter: true,
    //   isAlwaysVisible: true,
    //   filterable: false,
    //   renderHeader: () => (
    //     <div className="flex justify-center mr-[18px]">
    //       <Checkbox
    //         checked={allSelected}
    //         onCheckedChange={(checked) => {
    //           if (checked) {
    //             setDeselectedIds(new Set())
    //           } else {
    //             const allIds = participationData.map((row) => row.id)
    //             setDeselectedIds(new Set(allIds))
    //           }
    //         }}
    //         className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground w-5 h-5"
    //       />
    //     </div>
    //   ),
    //   render: (row) => (
    //     <div className="flex justify-center">
    //       <Checkbox
    //         checked={!deselectedIds.has(row.id)}
    //         onCheckedChange={(checked) => {
    //           setDeselectedIds((prev) => {
    //             const newSet = new Set(prev)
    //             if (!checked) {
    //               newSet.add(row.id)
    //             } else {
    //               newSet.delete(row.id)
    //             }
    //             return newSet
    //           })
    //         }}
    //         className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
    //       />
    //     </div>
    //   ),
    // },
    {
      key: 'stockNumber',
      header: 'מספר נייר /  \n נושאי האסיפה',
      type: 'string',
      minWidth: 80,
    },
    {
      key: 'corporateName',
      header: 'שם תאגיד',
      type: 'string',
      minWidth: 80,
    },
  ]

  if (selectedCompaniesCount > 1) {
    baseColumns.push({
      key: 'companyName',
      header: 'שם חברה',
      type: 'string',
      minWidth: 120,
      isAlwaysVisible: true,
      render: (row: any) => {
        return row.currentCompany?.name || '-'
      },
    })
  }

  baseColumns.push(
    { key: 'stockName', header: 'שם נייר', type: 'string', minWidth: 120 },
    {
      key: 'marketValue',
      header: `שווי שוק (מ' ₪)`,
      type: 'string',
      render: (row) => {
        const marketValue = parseNumber(row.marketValue)
        return formatNumberWithLocale(marketValue / 1_000_000, 0, 'he-IL')
      },
      minWidth: 80,
    },
    {
      key: 'percentageHolding',
      header: 'החזקה (%)',
      type: 'number',
      render: (row) => formatNumberWithLocale(row.percentageHolding, 4, 'he-IL'),
      minWidth: 80,
    },
    {
      key: 'holdingValueInMillions',
      header: `שווי החזקה (מ' ₪)`,
      type: 'number',
      render: (row) => formatNumberWithLocale(row.holdingValueInMillions, 2, 'he-IL'),
      minWidth: 80,
    },
    {
      key: 'meetingDate',
      header: 'מועד האסיפה',
      type: 'datetime',
      render: (row) => formatDateTime(row.meetingDate),
      minWidth: 120,
    },
    { key: 'meetingType', header: 'סוג האסיפה', type: 'string', minWidth: 80 },
    {
      key: 'advisoryRecommendation',
      header: 'המלצת גורם מייעץ',
      type: 'string',
      render: (row) => null,
      minWidth: 70,
    },
    {
      key: 'vote',
      header: 'הצבעה',
      type: 'string',
      render: (row) => null,
      minWidth: 70,
    },
    {
      key: 'meetingResults',
      header: 'תוצאות האסיפה',
      type: 'string',
      render: (row) => null,
      minWidth: 75,
    },
    {
      key: 'simpleMajority',
      header: 'רוב רגיל',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'specialMajority',
      header: 'רוב מיוחד (%)',
      type: 'string',
      render: (row) => null,
      minWidth: 40,
    },
    {
      key: 'policyCompliance',
      header: 'בהתאם למדיניות דירקטריון ו/או וועדת השקעות',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'conflictOfInterest',
      header: 'ניגוד עניינים',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 50,
    },
    {
      key: 'relatedParty',
      header: 'צד קשר',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 50,
    },
    {
      key: 'personalInterest',
      header: 'עניין אישי',
      type: 'boolean',
      render: (row) => null,
      positionCenter: true,
      minWidth: 50,
    },
  )

  return baseColumns
}

export const renderAgendaRows = (
  row: ParticipationTableDataType,
  participationColumns: Column<ParticipationTableDataType>[],
  selectedCompaniesCount: number,
) => {
  if (!row.agendas || row.agendas.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">אין פריטי סדר יום עבור אסיפה זו.</div>
    )
  }

  return (
    <div className="w-full">
      <table className="w-full table-fixed border-collapse" style={{ tableLayout: 'fixed' }}>
        <tbody>
          {row.agendas.map((agenda: any, agendaIndex: number) => {
            return (
              <tr key={agenda.id} className={cn(agendaIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                {participationColumns.map((column) => {
                  let content: React.ReactNode = null

                  switch (column.key) {
                    case 'select':
                      content = null
                      break
                    case 'companyName':
                      content = null
                      break
                    case 'stockNumber':
                      content = (
                        <div className="flex items-center justify-end gap-2 pr-16 pl-4">
                          <span style={{ marginLeft: 'auto', transform: 'translateX(20px)' }}>
                            {agenda.topicIndex}.
                          </span>
                        </div>
                      )
                      break
                    case 'stockName':
                      const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.())
                      content = (
                        <div
                          className={cn('relative group', isEnglish ? 'text-left' : 'text-right')}
                          dir={isEnglish ? 'ltr' : 'rtl'}
                        >
                          <div className="truncate cursor-pointer hover:text-blue-600 pr-[25px] w-[50rem]">
                            {agenda.text}
                          </div>
                          <div
                            className="absolute z-50 invisible group-hover:visible bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg max-w-md whitespace-normal break-words top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            style={{
                              [isEnglish ? 'left' : 'right']: 0,
                            }}
                          >
                            {agenda.text}
                            <div
                              className={cn(
                                'absolute bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent',
                                isEnglish
                                  ? 'left-4 border-b-gray-900'
                                  : 'right-4 border-b-gray-900',
                              )}
                            />
                          </div>
                        </div>
                      )
                      break
                    case 'advisoryRecommendation':
                      content = (
                        <div>
                          {agenda.recommendation?.votingRecommendation ||
                            agenda.recommendation?.recommendationExplanation ||
                            null}
                        </div>
                      )
                      break
                    case 'vote':
                      content = agenda.vote || null
                      break
                    case 'meetingResults':
                      content = agenda.result
                        ? resultMapping[agenda.result] || agenda.result
                        : agenda.meetingResults || null
                      break
                    case 'simpleMajority':
                      content = <BooleanIcon iconType={!agenda.privilegedMajority} />
                      break
                    case 'specialMajority':
                      content =
                        agenda.privilegedMajority === true && agenda.vPercentSpecial
                          ? `${agenda.vPercentSpecial}%`
                          : null
                      break
                    case 'policyCompliance':
                      content =
                        agenda.policyCompliance !== undefined &&
                        agenda.policyCompliance !== null ? (
                          <BooleanIcon iconType={agenda.policyCompliance} />
                        ) : null
                      break
                    case 'conflictOfInterest':
                      content =
                        agenda.conflictOfInterest !== undefined &&
                        agenda.conflictOfInterest !== null ? (
                          <BooleanIcon iconType={agenda.conflictOfInterest} />
                        ) : null
                      break
                    case 'relatedParty':
                      content =
                        agenda.relatedParty !== undefined && agenda.relatedParty !== null ? (
                          <BooleanIcon iconType={agenda.relatedParty} />
                        ) : null
                      break
                    case 'personalInterest':
                      content =
                        agenda.personalInterest !== undefined &&
                        agenda.personalInterest !== null ? (
                          <BooleanIcon iconType={agenda.personalInterest} />
                        ) : null
                      break
                    default:
                      content = null
                      break
                  }

                  if (
                    column.key === 'marketValue' ||
                    column.key === 'percentageHolding' ||
                    column.key === 'holdingValueInMillions' ||
                    column.key === 'meetingDate' ||
                    column.key === 'meetingType' ||
                    column.key === 'companyName'
                  ) {
                    return null
                  }

                  const baseColspan = 5
                  const companyColumnExists = selectedCompaniesCount > 1
                  const totalColspan =
                    column.key === 'stockName' ? baseColspan + (companyColumnExists ? 1 : 0) : 1

                  return (
                    <td
                      key={`${agenda.id}-${column.key}`}
                      className={cn(
                        'py-1 px-2 border-t',
                        column.positionCenter ? 'text-center' : 'text-right',
                      )}
                      style={{
                        width:
                          column.key === 'stockName'
                            ? selectedCompaniesCount > 1
                              ? '450px'
                              : '450px'
                            : `${column.minWidth}px`,
                        minWidth: column.key === 'stockName' ? '200px' : `${column.minWidth}px`,
                        maxWidth: column.key === 'stockName' ? '100%' : `${column.minWidth}px`,
                        textAlign: column.positionCenter ? 'center' : 'right',
                        verticalAlign: 'middle',
                      }}
                      colSpan={totalColspan}
                    >
                      {content}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
