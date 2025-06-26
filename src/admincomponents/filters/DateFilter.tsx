'use client'
import React from 'react'
import { useListQuery } from '@payloadcms/ui'
import { Button } from '@payloadcms/ui/elements/Button'

type Preset = 'today' | 'thisMonth'

const DateFilter = ({ preset }: { preset: Preset }) => {
  const { refineListData } = useListQuery()

  const handleClick = async () => {
    const now = new Date()
    let start: Date, end: Date

    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

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

  return <Button onClick={handleClick}>{preset === 'today' ? 'היום' : 'החודש'}</Button>
}

export default DateFilter
