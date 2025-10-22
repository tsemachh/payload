'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useListQuery } from '@payloadcms/ui'
import type { Where } from 'payload'

const TaskMenu: React.FC = () => {
  const { user } = useAuth()
  const { refineListData, query } = useListQuery()

  const [onlyMy, setOnlyMy] = useState(false)

  // Derive if current query filters by assignee to this user
  const isMyAssigneeActive = useMemo(() => {
    const w = query?.where as any
    const assignee = w?.assignee
    const equalsVal = assignee?.equals ?? assignee?.eq ?? assignee
    return Boolean(equalsVal) && String(equalsVal) === String(user?.id ?? '')
  }, [query?.where, user?.id])

  useEffect(() => {
    setOnlyMy(isMyAssigneeActive)
  }, [isMyAssigneeActive])

  const toggleOnlyMy = useCallback(
    (checked: boolean) => {
      setOnlyMy(checked)

      // Start from current where and only add/remove the assignee filter
      const currentWhere: Record<string, any> =
        query?.where && typeof query.where === 'object' ? { ...(query.where as any) } : {}

      // Remove any existing assignee filter first
      if (currentWhere && typeof currentWhere === 'object') {
        delete (currentWhere as any).assignee
      }

      if (checked) {
        currentWhere.assignee = { equals: user?.id }
      }

      refineListData({ where: currentWhere as Where, page: 1 })
    },
    [query?.where, refineListData, user?.id],
  )

  return (
    <div className="flex items-center justify-start" style={{ direction: 'ltr' }}>
      <div
        className="flex items-center gap-2 mx-20"
        style={{
          position: 'absolute',
          left: 0,
          direction: 'ltr',
        }}
      >
        <label className="flex items-center gap-2 text-sm" style={{ direction: 'rtl' }}>
          <input
            type="checkbox"
            checked={onlyMy}
            onChange={(e) => toggleOnlyMy(e.target.checked)}
          />
          <span>הצג התראות שלי בלבד</span>
        </label>
      </div>
    </div>
  )
}

export default TaskMenu
