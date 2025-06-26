'use client'
import React from 'react'
import { useListQuery } from '@payloadcms/ui'
import { Pill } from '@payloadcms/ui'

type Preset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'

const DateFilter = ({ preset, ...otherProps }: { preset: Preset }) => {
  const { refineListData } = useListQuery()

  const handleClick = async () => {
    const now = new Date()
    let start: Date | undefined
    let end: Date | undefined

    const clone = (date: Date): Date => new Date(date.getTime())

    if (preset === 'today') {
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      end = clone(start)
      end.setDate(end.getDate() + 1)
    } else if (preset === 'yesterday') {
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - 1)
      end = clone(start)
      end.setDate(end.getDate() + 1)
    } else if (preset === 'thisWeek') {
      start = new Date(now)
      start.setDate(start.getDate() - start.getDay())
      start.setHours(0, 0, 0, 0)
      end = clone(start)
      end.setDate(end.getDate() + 7)
    } else if (preset === 'lastWeek') {
      start = new Date(now)
      start.setDate(start.getDate() - start.getDay() - 7)
      start.setHours(0, 0, 0, 0)
      end = clone(start)
      end.setDate(end.getDate() + 7)
    } else if (preset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    } else if (preset === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    if (!start || !end) return

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

  const labels: Record<Preset, string> = {
    today: 'היום',
    yesterday: 'אתמול',
    thisWeek: 'השבוע',
    lastWeek: 'שבוע שעבר',
    thisMonth: 'החודש',
    lastMonth: 'חודש שעבר',
  }
  return (
    <>
      <Pill onClick={handleClick}>{labels[preset]}</Pill>{' '}
    </>
  )
}

export default DateFilter
