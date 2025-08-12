'use client'

import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth, useListQuery } from '@payloadcms/ui'

const TaskMenu: React.FC = () => {
  const { user } = useAuth()
  const { refineListData, query } = useListQuery()
  const [activeMenu, setActiveMenu] = useState<'my-tasks' | 'all-tasks'>('all-tasks')

  // Determine active menu based on current query
  useEffect(() => {
    if (query.where && 
        typeof query.where === 'object' && 
        'assignee' in query.where && 
        typeof query.where.assignee === 'object' &&
        'equals' in query.where.assignee &&
        query.where.assignee.equals === user?.id) {
      setActiveMenu('my-tasks')
    } else {
      setActiveMenu('all-tasks')
    }
  }, [query.where, user?.id])

  const handleMenuClick = useCallback((menu: 'my-tasks' | 'all-tasks') => {
    if (activeMenu !== menu) {
      setActiveMenu(menu)

      // Build the where clause based on the selected menu
      const whereClause: Record<string, any> = {
        handled: { equals: false }
      }

      if (menu === 'my-tasks' && user?.id) {
        whereClause.assignee = { equals: user.id }
      }

      // Update the query using refineListData
      refineListData({
        where: whereClause,
        page: 1
      })
    }
  }, [activeMenu, refineListData, user?.id])

  return (
    <div className="flex items-center justify-start" style={{ direction: 'ltr' }}>
      <div className="flex items-center gap-1 mx-20"  style={{
        position: 'absolute',
        left: 0, // Aligns to the left side of the parent (in RTL, this is visually left)
        direction: 'ltr', // Ensures left-alignment respects LTR for positioning
      }}>
        <Button
          variant={activeMenu === 'my-tasks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleMenuClick('my-tasks')}
          className="text-sm min-w-fit"
          style={{ direction: 'rtl' }}
        >
          ההתראות שלי
        </Button>        <Button
          variant={activeMenu === 'all-tasks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleMenuClick('all-tasks')}
          className="text-sm min-w-fit"
          style={{ direction: 'rtl' }}
        >
          כל ההתראות
        </Button>
      </div>
    </div>
  )
}

export default TaskMenu
