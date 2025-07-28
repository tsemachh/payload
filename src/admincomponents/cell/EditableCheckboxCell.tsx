'use client'
import React, { useCallback, useState } from 'react'
import type { CheckboxFieldClient, DefaultCellComponentProps } from 'payload'
import { toast } from '@payloadcms/ui'
import { useLocale } from '@/plugins/impersonate/hooks/useLocale'

const EditableCheckboxCell: React.FC<DefaultCellComponentProps<CheckboxFieldClient>> = (props) => {
  const { cellData, collectionSlug, rowData, field } = props
  const { id } = rowData

  const [isChecked, setIsChecked] = useState<boolean>(cellData)
  const locale = useLocale()

  // Toast messages for both languages
  const messages = {
    success: {
      en: 'Notification updated successfully',
      he: 'ההתראה עודכנה בהצלחה',
    },
    error: {
      en: 'Failed to update notification',
      he: 'עדכון ההתראה נכשל',
    },
  }

  const handleCheckboxChange = useCallback(async () => {
    const timestamp = Date.now()

    try {
      const response = await fetch(`/api/${collectionSlug}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [field.name]: !isChecked,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update notification')
      }

      setIsChecked(!isChecked)

      // Show success toast using Payload's sonner toast
      toast.success(
        messages.success[locale as keyof typeof messages.success] || messages.success.en,
        {
          description: rowData.message || `ID: ${id}`,
          id: `success-${id}-${timestamp}`,
        },
      )
    } catch (error) {
      console.error('Error updating notification:', error)

      // Show error toast using Payload's sonner toast
      toast.error(messages.error[locale as keyof typeof messages.error] || messages.error.en, {
        description: rowData.message || `ID: ${id}`,
        id: `error-${id}-${timestamp}`,
      })
    }
  }, [id, isChecked, locale, messages])

  return (
    <div>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleCheckboxChange}
        style={{
          width: '16px',
          height: '16px',
          cursor: 'pointer',
        }}
      />
    </div>
  )
}

export default EditableCheckboxCell
