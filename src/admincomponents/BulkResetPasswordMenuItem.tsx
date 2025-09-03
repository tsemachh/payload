'use client'

import React from 'react'
import { PopupList, toast, useSelection } from '@payloadcms/ui'

export const BulkResetPasswordMenuItem = () => {
  const { getSelectedIds } = useSelection()

  const handleBulkResetPassword = async () => {
    const selectedRows = await getSelectedIds()
    if (selectedRows.length === 0) {
      toast.warning('לא נבחרו משתמשים', {
        description: 'אנא בחר לפחות משתמש אחד לאיפוס סיסמה',
        duration: 1500,
      })
      return
    }

    try {
      // Process each selected user
      const resetEmails: string[] = []
      const results = await Promise.all(
        selectedRows.map(async (userId) => {
          // You'll need to fetch the user's email first
          const userResponse = await fetch(`/api/users/${userId}`)
          const userData = await userResponse.json()

          // Store the email for the success message
          if (userData.email) {
            resetEmails.push(userData.email)
          }

          // Then trigger password reset
          const resetResponse = await fetch(`/api/users/forgot-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userData.email,
            }),
          })

          return resetResponse.ok
        }),
      )

      const successCount = results.filter(Boolean).length
      const emailsList = resetEmails.join(', ')

      toast.success('איפוס סיסמה', {
        description: `נשלחו בהצלחה הודעות איפוס סיסמה ל-${successCount} מתוך ${selectedRows.length} משתמשים: ${emailsList}`,
      })
    } catch (error) {
      console.error(error)
      toast.error('שגיאה באיפוס סיסמאות', {
        description: 'אירעה שגיאה בתהליך איפוס הסיסמאות',
      })
    }
  }

  return (
    <PopupList.Button onClick={handleBulkResetPassword}>
      אפס סיסמא למשתמשים הנבחרים
    </PopupList.Button>
  )
}

export default BulkResetPasswordMenuItem
