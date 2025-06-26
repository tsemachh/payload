'use client'
import React from 'react'
import { useListQuery } from '@payloadcms/ui'
import { Button } from '@payloadcms/ui/elements/Button'
import { Pill, useTableColumns } from '@payloadcms/ui'

type Preset = 'today' | 'thisMonth'

const DateFilter = ({ preset }: { preset: Preset }) => {
  const { refineListData } = useListQuery()

  const handleClick = async () => {
    const now = new Date()
    let start: Date, end: Date

    if (preset === 'today') {
      // טווח של היום בלבד
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      end = new Date(start)
      end.setDate(start.getDate() + 1)
    } else {
      // טווח של החודש
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    }

    await refineListData({
      where: {
        meetingDate: {
          greater_than_equal: start.toISOString(),
          less_than: end.toISOString(),
        },
      },
      page: '1',
    })
  }

  return (
    <>
      <Pill onClick={handleClick}>{preset === 'today' ? 'היום' : 'החודש'}</Pill>{' '}
    </>
  )
}

export default DateFilter
