'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { formatDateTime, parseNumber } from '../helpers/utils-data-table'
import type { Column } from '../types/meetings'
import { BooleanIcon } from '@/components/ui/icons'
import type { ParticipationAgendaType, ParticipationTableDataType } from './types'
import { resultMapping } from '@/lib/exportTypes'
import { formatNumberWithLocale } from '@/utils/numberUtils'
import { TableCell, TableRow } from '../components/ui/table'
import { v4 as uuidv4 } from 'uuid'
export const createParticipationColumns = (
  selectedCompaniesCount: number,
  allSelected: boolean,
  participationData: ParticipationTableDataType[],
  deselectedIds: Set<string>,
  setDeselectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
): Column<ParticipationTableDataType>[] => {
  const displayVotingRecommendation = participationData.some(
    (row) => row.displayVotingRecommendation == true,
  )
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
      isAlwaysVisible: true,
      minWidth: 80,
    },
    {
      key: 'corporateName',
      header: 'שם תאגיד',
      type: 'string',
      isAlwaysVisible: true,
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
      isAlwaysVisible: true,
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
      isAlwaysVisible: true,
      type: 'number',
      render: (row) => formatNumberWithLocale(row.percentageHolding, 4, 'he-IL'),
      minWidth: 80,
    },
    {
      key: 'holdingValueInMillions',
      header: `שווי החזקה (מ' ₪)`,
      isAlwaysVisible: true,
      type: 'number',
      render: (row) => formatNumberWithLocale(row.holdingValueInMillions, 2, 'he-IL'),
      minWidth: 80,
    },
    {
      key: 'meetingDate',
      header: 'מועד האסיפה',
      isAlwaysVisible: true,
      type: 'datetime',
      render: (row) => formatDateTime(row.meetingDate, true),
      minWidth: 80,
    },
    { key: 'meetingType', header: 'סוג האסיפה', type: 'string', minWidth: 80 },
  )
  if (displayVotingRecommendation) {
    baseColumns.push({
      key: 'recommendation',
      header: 'המלצת הצבעה ',
      isAlwaysVisible: true,
      type: 'string',
      render: () => null,
      minWidth: 70,
    })
  }

  baseColumns.push(
    {
      key: 'vote',
      header: 'הצבעה',
      isAlwaysVisible: true,
      type: 'string',
      render: () => null,
      minWidth: 70,
    },
    {
      key: 'meetingResults',
      header: 'תוצאות האסיפה',
      isAlwaysVisible: true,
      type: 'string',
      render: () => null,
      minWidth: 75,
    },
    {
      key: 'simpleMajority',
      header: 'רוב רגיל',
      isAlwaysVisible: true,
      type: 'boolean',
      render: () => null,
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'privilegedMajority',
      header: 'רוב מיוחד (%)',
      isAlwaysVisible: true,
      type: 'string',
      render: () => null,
      minWidth: 40,
    },
    {
      key: 'policyCompliance',
      header: 'בהתאם למדיניות דריקטוריון ו/או וועדת השקעות',
      isAlwaysVisible: true,
      type: 'boolean',
      render: () => null,
      positionCenter: true,
      minWidth: 60,
    },
    {
      key: 'conflictOfInterest',
      header: 'ניגוד עניינים',
      isAlwaysVisible: true,
      type: 'boolean',
      render: () => null,
      positionCenter: true,
      minWidth: 50,
    },
    {
      key: 'relatedParty',
      header: 'צד קשר',
      isAlwaysVisible: true,
      type: 'boolean',
      render: () => null,
      positionCenter: true,
      minWidth: 50,
    },
    {
      key: 'personalInterest',
      header: 'עניין אישי',
      isAlwaysVisible: true,
      type: 'boolean',
      render: () => null,
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
  return (
    <>
      {row.agendas.map((agenda: ParticipationAgendaType, agendaIndex: number) => (
        <TableRow
          key={`participation-${uuidv4()}`}
          className="bg-muted/70 border-t-0 hover:bg-primary/20"
        >
          {/* Empty cell for companies column */}
          <TableCell className="py-2 px-6"></TableCell>

          {/* Map through visible columns and show relevant fund data */}
          {participationColumns.slice(1).map((column, columnIndex) => {
            if (column.key in agenda) {
              return (
                <TableCell
                  key={`fund-${uuidv4()}-${String(column.key)}`}
                  className="py-2 px-3 whitespace-nowrap"
                  style={{ textAlign: 'right' }}
                >
                  {(() => {
                    let value = agenda[column.key as keyof ParticipationAgendaType]
                    if (column.key === 'recommendation') {
                      value = agenda.recommendation.votingRecommendation
                    }
                    if (column.key === 'privilegedMajority') {
                      return agenda.privilegedMajority && agenda.percentResult ? (
                        `${formatNumberWithLocale(agenda.percentResult)}%`
                      ) : (
                        <BooleanIcon iconType={agenda.privilegedMajority} showX={false} />
                      )
                    }
                    if (column.key === 'simpleMajority') {
                      return agenda.simpleMajority && agenda.percentResult ? (
                        `${formatNumberWithLocale(agenda.percentResult)}%`
                      ) : (
                        <BooleanIcon iconType={agenda.simpleMajority} showX={false} />
                      )
                    }
                    if (column.key === 'meetingResults') {
                      value = agenda.result
                        ? resultMapping[agenda.result] || agenda.result
                        : agenda.meetingResults || null
                    }
                    if (typeof value === 'number') {
                      return new Intl.NumberFormat('he-IL').format(value)
                    }
                    if (typeof value === 'string') {
                      return value
                    }
                    if (typeof value === 'boolean') {
                      return <BooleanIcon iconType={value} showX={false} />
                    }
                  })()}
                </TableCell>
              )
            } else {
              return (
                <TableCell
                  key={`fund-${uuidv4()}-${String(column.key)}`}
                  className="py-2 px-3  whitespace-nowrap"
                >
                  {columnIndex === 0 && (
                    <div className="relative h-40px flex items-center gap-2 -mr-[100px]">
                      <span className="text-muted-foreground font-medium">{agendaIndex + 1}.</span>

                      {(() => {
                        const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.() || '')
                        return (
                          <div
                            className={cn('relative group', isEnglish ? 'text-left' : 'text-right')}
                            dir={isEnglish ? 'ltr' : 'rtl'}
                          >
                            <div
                              className="truncate cursor-pointer hover:text-blue-600 inline-block flex-shrink-0"
                              style={{ maxWidth: '800px' }}
                            >
                              {agenda.text}
                            </div>

                            {/* tooltip */}
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
                      })()}
                    </div>
                  )}
                </TableCell>
              )
            }
          })}
        </TableRow>
      ))}
    </>
  )
}
