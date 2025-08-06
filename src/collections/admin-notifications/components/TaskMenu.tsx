'use client'

import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@payloadcms/ui'

// Custom hook to manage task menu state
const useTaskMenu = () => {
  // Initialize state with default values for consistent server/client rendering
  const [activeMenu, setActiveMenu] = useState<'my-tasks' | 'all-tasks'>('my-tasks')

  // Use useEffect to update state from localStorage on client-side only
  useEffect(() => {
    // This code only runs on the client after initial render
    const savedMenu = localStorage.getItem('taskMenu.activeMenu')
    if (savedMenu === 'my-tasks' || savedMenu === 'all-tasks') {
      setActiveMenu(savedMenu)
    }
  }, [])

  return {
    activeMenu,
    setActiveMenu: useCallback((menu: 'my-tasks' | 'all-tasks') => {
      setActiveMenu(menu)
      // You can add additional logic here if needed
      // For example, you could save the preference to localStorage
      localStorage.setItem('taskMenu.activeMenu', menu)
    }, []),
  }
}

const TaskMenu: React.FC = () => {
  const { user } = useAuth()
  const { activeMenu, setActiveMenu } = useTaskMenu()

  const getTaskUrl = (menu: 'my-tasks' | 'all-tasks') => {
    const baseUrl = '/admin/collections/admin-notifications'

    if (menu === 'my-tasks') {
      const assigneeFilter = `where[assignee][equals]=${user?.id}`
      const handledFilter = `&where[handled][equals]=false`
      return `${baseUrl}?${assigneeFilter}${handledFilter}`
    } else {
      const handledFilter = `where[handled][equals]=false`
      return `${baseUrl}?${handledFilter}`
    }
  }

  const handleMenuClick = (menu: 'my-tasks' | 'all-tasks') => {
    setActiveMenu(menu)
    // Navigate to the appropriate URL
    const url = getTaskUrl(menu)
    if (typeof window !== 'undefined') {
      window.location.href = url
    }
  }

  return (
    <div className="border-b bg-background">
      {/* Tab buttons and checkbox on same line */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-1">
          <Button
            variant={activeMenu === 'my-tasks' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleMenuClick('my-tasks')}
            className="text-sm"
            style={{ direction: 'rtl' }}
          >
            ההתראות שלי
          </Button>
          <Button
            variant={activeMenu === 'all-tasks' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleMenuClick('all-tasks')}
            className="text-sm"
            style={{ direction: 'rtl' }}
          >
            כל ההתראות
          </Button>
        </div>
      </div>
    </div>
  )
}

export default TaskMenu
