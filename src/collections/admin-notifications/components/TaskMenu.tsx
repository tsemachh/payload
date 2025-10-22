'use client'

import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth, useListQuery } from '@payloadcms/ui'
import type { Where } from 'payload'

export const defaultQuery: Where = {
  handled: { equals: false },
  type: { equals: 'newVoteAfterHoldingLimit' },
}

const allQuery: Where = { handled: { equals: false } }

const TaskMenu: React.FC = () => {
  const { user } = useAuth()
  const { refineListData, query } = useListQuery()
  const [activeMenu, setActiveMenu] = useState<'my-tasks' | 'all-tasks' | 'default'>('default')

  // Determine active menu based on current query
  useEffect(() => {
    if (query.where && typeof query.where === 'object') {
      const currentQuery = JSON.stringify(query.where)
      switch (currentQuery) {
        case JSON.stringify(defaultQuery):
          setActiveMenu('default')
          return
        case JSON.stringify(allQuery):
          setActiveMenu('all-tasks')
          return
        default:
          if (currentQuery.includes('assignee') && currentQuery.includes('handled'))
            setActiveMenu('my-tasks')
      }
    }
  }, [query.where])

  const handleMyTasksClick = useCallback(() => {
    setActiveMenu('my-tasks')
    refineListData({
      where: {
        assignee: { equals: user?.id },
        handled: { equals: false },
      },
      page: 1,
    })
  }, [refineListData, user?.id])

  const handleAllTasksClick = useCallback(() => {
    setActiveMenu('all-tasks')
    refineListData({
      where: allQuery,
      page: 1,
    })
  }, [refineListData])

  const handleDefaultClick = useCallback(() => {
    setActiveMenu('default')
    refineListData({
      where: defaultQuery,
      page: 1,
    })
  }, [refineListData])

  return (
    <div className="flex items-center justify-start" style={{ direction: 'ltr' }}>
      <div
        className="flex items-center gap-1 mx-20"
        style={{
          position: 'absolute',
          left: 0, // Aligns to the left side of the parent (in RTL, this is visually left)
          direction: 'ltr', // Ensures left-alignment respects LTR for positioning
        }}
      >
        <Button
          variant={activeMenu === 'my-tasks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleMyTasksClick()}
          className="text-sm min-w-fit"
          style={{ direction: 'rtl' }}
        >
          ההתראות שלי
        </Button>{' '}
        <Button
          variant={activeMenu === 'all-tasks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleAllTasksClick()}
          className="text-sm min-w-fit"
          style={{ direction: 'rtl' }}
        >
          כל ההתראות
        </Button>
        <Button
          variant={activeMenu === 'default' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleDefaultClick()}
          className="text-sm min-w-fit"
          style={{ direction: 'rtl' }}
        >
          ברירת מחדל
        </Button>
      </div>
    </div>
  )
}

export default TaskMenu
