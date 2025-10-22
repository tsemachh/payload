'use client'

import React from 'react'
import { PopupList, toast, useSelection } from '@payloadcms/ui'

const BulkRecalculateUserMembershipsMenuItem: React.FC = () => {
  const { getSelectedIds } = useSelection()

  const handleBulkRecalculate = async () => {
    const selectedRows = await getSelectedIds()

    if (!selectedRows || selectedRows.length === 0) {
      toast.warning('לא נבחרו משתמשים', {
        description: 'אנא בחר לפחות משתמש אחד לחישוב מחדש',
        duration: 1500,
      })
      return
    }

    try {
      const results = await Promise.all(
        selectedRows.map(async (userId: string | number) => {
          const response = await fetch(`/api/users/${userId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              funds: [],
            }),
          })
          return response.ok
        }),
      )

      const successCount = results.filter(Boolean).length

      toast.success('חישוב מחדש הושלם', {
        description: `עודכנו בהצלחה ${successCount} מתוך ${selectedRows.length} משתמשים`,
      })
    } catch (error) {
      console.error(error)
      toast.error('שגיאה בחישוב מחדש', {
        description: 'אירעה שגיאה במהלך עדכון המשתמשים',
      })
    }
  }

  return <PopupList.Button onClick={handleBulkRecalculate}>חשב מחדש חברות משתמש</PopupList.Button>
}

export default BulkRecalculateUserMembershipsMenuItem
