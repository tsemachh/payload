'use client'

import type React from 'react'
import { cn } from '@/lib/utils'
import {
  calculatePrecedingColumnsWidth,
  formatDateTime,
  parseNumber,
} from '../helpers/utils-data-table'
import type { Column } from '../types/meetings'
import { BooleanIcon } from '@/components/ui/icons'
import type { ParticipationAgendaType, ParticipationTableDataType } from './types'
import { Checkbox } from '@/components/ui/checkbox'
import { resultMapping } from '@/lib/exportTypes'
import { TableCell, TableRow } from '../components/ui/table'
import { v4 as uuidv4 } from 'uuid'

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
        return new Intl.NumberFormat('he-IL', {
          maximumFractionDigits: 0,
        }).format(marketValue / 1_000_000)
      },
      minWidth: 80,
    },
    {
      key: 'percentageHolding',
      header: 'החזקה (%)',
      type: 'number',
      render: (row) =>
        new Intl.NumberFormat('he-IL', {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        }).format(row.percentageHolding),
      minWidth: 80,
    },
    {
      key: 'holdingValueInMillions',
      header: `שווי החזקה (מ' ₪)`,
      type: 'number',
      render: (row) =>
        new Intl.NumberFormat('he-IL', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(row.holdingValueInMillions),
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
      key: 'recommendation',
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
            console.log('column', column)
            if (column.key in agenda) {
              console.log('yes', agenda)
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
                      return <BooleanIcon iconType={value} />
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

                      <span
                        className="truncate inline-block flex-shrink-0"
                        style={{ maxWidth: '800px' }}
                      >
                        {agenda.text}
                      </span>
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
