'use client'

import type React from 'react'
import { useState } from 'react'
import { useListQuery } from '@payloadcms/ui'
import { toast } from 'sonner'

const ExportMeetingsMenuItem: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false)
  const { query } = useListQuery()

  const handleExport = async () => {
    try {
      setIsExporting(true)

      // Build query parameters from current filters
      const params = new URLSearchParams()

      if (query?.where) {
        params.append('where', JSON.stringify(query.where))
      }

      if (query?.sort) {
        const sortValue = Array.isArray(query.sort) ? query.sort[0] : query.sort
        params.append('sort', sortValue)
      }

      // Set a reasonable limit for export
      params.append('limit', '1000')

      // Call the export endpoint with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

      const response = await fetch(`/api/meetings/export-excel?${params.toString()}`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to export Excel file')
      }

      // Get the blob from response
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `אסיפות_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()

      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('הקובץ יוצא בהצלחה')
    } catch (error: any) {
      console.error('Export error:', error)
      if (error?.name === 'AbortError') {
        toast.error('הייצוא נקטע בגלל זמן המתנה ארוך מדי', {
          description: 'אנא נסה עם פחות נתונים או פנה למנהל המערכת',
        })
      } else {
        toast.error('שגיאה בייצוא הקובץ', {
          description: 'אנא נסה שוב או פנה למנהל המערכת',
        })
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      style={{
        background: 'none',
        border: 'none',
        margin: 0,
        color: 'inherit',
        font: 'inherit',
        cursor: isExporting ? 'default' : 'pointer',
      }}
    >
      {isExporting ? 'מייצא המלצות...' : 'ייצוא המלצות'}
    </button>
  )
}

export default ExportMeetingsMenuItem
