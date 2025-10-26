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
    const w = (query?.where || {}) as any

    // 1) Check root-level assignee
    const rootAssignee = w?.assignee
    const rootEquals = rootAssignee?.equals ?? rootAssignee?.eq ?? rootAssignee
    if (Boolean(rootEquals) && String(rootEquals) === String(user?.id ?? '')) return true

    // 2) Check inside existing `and` array
    const andArr = Array.isArray(w?.and) ? (w.and as any[]) : []
    for (const clause of andArr) {
      if (clause && typeof clause === 'object' && 'assignee' in clause) {
        const a = (clause as any).assignee
        const eqVal = a?.equals ?? a?.eq ?? a
        if (Boolean(eqVal) && String(eqVal) === String(user?.id ?? '')) return true
      }
    }

    return false
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

      // Ensure we don't mutate nested arrays/objects inadvertently
      if (Array.isArray(currentWhere.and)) {
        currentWhere.and = [...currentWhere.and]
      }

      // Remove any existing assignee filter first — root and inside `and`
      delete (currentWhere as any).assignee
      if (Array.isArray(currentWhere.and)) {
        currentWhere.and = currentWhere.and.filter((clause: any) => {
          if (!clause || typeof clause !== 'object') return true
          // remove any clause that specifies assignee (regardless of value)
          return !('assignee' in clause)
        })
      }

      if (checked) {
        const assigneeClause = { assignee: { equals: user?.id } }

        if (Array.isArray(currentWhere.and)) {
          // If `and` exists, add assignee as part of it
          currentWhere.and.push(assigneeClause)
        } else if (currentWhere && Object.keys(currentWhere).length > 0) {
          // If there are existing root filters but no `and`, keep behavior minimal:
          // Requirement: only ensure assignee is part of `and` IF `and` exists.
          // However, if we want to strictly normalize, we could wrap; but we'll keep it simple
          // and attach at root only when no `and` exists.
          currentWhere.assignee = assigneeClause.assignee
        } else {
          // No filters at all — just set root-level assignee
          currentWhere.assignee = assigneeClause.assignee
        }
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
