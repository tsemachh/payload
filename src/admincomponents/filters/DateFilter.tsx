'use client'
import React from 'react'
import { useListQuery } from '@payloadcms/ui'
import { Pill } from '@payloadcms/ui'

type Preset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'

const DateFilter = ({ preset }: { preset: Preset }) => {
  const { refineListData } = useListQuery()

  const handleClick = async () => {
    const now = new Date()
    let start: Date | undefined, end: Date | undefined

    const clone = (date: Date) => new Date(date.getTime())

    switch (preset) {
      case 'today':
        start = new Date(now)
        start.setHours(0, 0, 0, 0)
        end = clone(start)
        end.setDate(end.getDate() + 1)
        break
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        break
    }

    if (!start || !end) {
      // Optionally handle error or return early
      return
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
