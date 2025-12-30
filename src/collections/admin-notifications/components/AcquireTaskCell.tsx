'use client'
import React, { useCallback } from 'react'
import type { DefaultCellComponentProps, TextFieldClient } from 'payload'
import { toast, useAuth, useListQuery } from '@payloadcms/ui'
import { useLocale } from '@/plugins/impersonate/hooks/useLocale'
import { Button } from '@/components/ui/button'

const AcquireTaskCell: React.FC<DefaultCellComponentProps<TextFieldClient>> = (props) => {
  const { collectionSlug, rowData } = props
  const { id } = rowData
  const { user } = useAuth()
  const locale = useLocale()
  const { refineListData, query } = useListQuery()

  // Toast messages for both languages and different operations
  const messages = {
    update: {
      success: {
        en: 'Task acquired successfully',
        he: 'המשימה נלקחה בהצלחה',
      },
      error: {
        en: 'Failed to acquire task',
        he: 'לקיחת המשימה נכשלה',
      },
    },
    return: {
      success: {
        en: 'Task returned successfully',
        he: 'המשימה הוחזרה בהצלחה',
      },
      error: {
        en: 'Failed to return task',
        he: 'החזרת המשימה נכשלה',
      },
    },
    finish: {
      success: {
        en: 'Task completed successfully',
        he: 'המשימה הושלמה בהצלחה',
      },
      error: {
        en: 'Failed to complete task',
        he: 'השלמת המשימה נכשלה',
      },
    },
  }

  const updateTask = useCallback(
    async (
      data: Record<string, any>,
      successDescription: string,
      errorDescription: string,
      actionType: string = '',
    ) => {
      const timestamp = Date.now()
      // Get the appropriate messages for this action type
      const actionMessages = messages[actionType as keyof typeof messages] || messages.update

      try {
        const response = await fetch(`/api/${collectionSlug}/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          throw new Error(`Failed to ${actionType} notification`)
        }

        // Show success toast using Payload's sonner toast
        toast.success(
          actionMessages.success[locale as keyof typeof actionMessages.success] ||
            actionMessages.success.en,
          {
            description: successDescription,
            id: `success-${actionType}-${id}-${timestamp}`,
          },
        )
        // Force refresh the list data even if the assignee field stays the same
        await refineListData(query, true)
      } catch (error) {
        console.error(`Error ${actionType} notification:`, error)

        // Show error toast using Payload's sonner toast
        toast.error(
          actionMessages.error[locale as keyof typeof actionMessages.error] ||
            actionMessages.error.en,
          {
            description: errorDescription,
            id: `error-${actionType}-${id}-${timestamp}`,
          },
        )
      }
    },
    [id, locale, messages, collectionSlug, refineListData, query],
  )

  const handleButtonClick = useCallback(() => {
    updateTask(
      { assignee: user?.id },
      rowData.message || `ID: ${id}`,
      rowData.message || `ID: ${id}`,
      'update',
    )
  }, [updateTask, user?.id, rowData.message, id])

  const handleReturnTask = useCallback(() => {
    updateTask(
      { assignee: null },
      rowData.message || `ID: ${id}`,
      rowData.message || `ID: ${id}`,
      'return',
    )
  }, [updateTask, rowData.message, id])

  const handleFinishTask = useCallback(() => {
    updateTask(
      { handled: true },
      rowData.message || `ID: ${id}`,
      rowData.message || `ID: ${id}`,
      'finish',
    )
  }, [updateTask, rowData.message, id])

  return (
    <>
      {user?.id === rowData?.assignee ? (
        <div className="flex gap-2">
          <Button 
            variant={'secondary'} 
            onClick={handleFinishTask}
            disabled={rowData?.handled}
          >
            לסיים
          </Button>
        </div>
      ) : (
        <Button variant={'secondary'} onClick={handleButtonClick}>
          לקבל
        </Button>
      )}
    </>
  )
}

export default AcquireTaskCell
