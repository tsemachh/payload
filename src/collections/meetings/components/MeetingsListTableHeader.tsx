"use client"

import type React from "react"
import { useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useListQuery } from "@payloadcms/ui"
import { toast } from "sonner"

const ExportExcelButton: React.FC = () => {
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
        signal: controller.signal
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
          description: 'אנא נסה עם פחות נתונים או פנה למנהל המערכת'
        })
      } else {
        toast.error('שגיאה בייצוא הקובץ', {
          description: 'אנא נסה שוב או פנה למנהל המערכת'
        })
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: `170px`,
        left: "61px",
        zIndex: 1000,
      }}
    >
      <Button
        variant="default"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
        style={{ borderRadius: '7px' }}
        className={`
          flex items-center gap-2 h-9 px-3 py-2 
          bg-gradient-to-r from-green-600 to-green-700 
          hover:from-green-700 hover:to-green-800 
          text-white font-medium
          border-0 shadow-md hover:shadow-lg
          transition-all duration-200 ease-in-out
          transform hover:scale-105 active:scale-95
          rounded-xl
          ${isExporting ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">מייצא...</span>
          </>
        ) : (
          <>
            <FileSpreadsheet className="h-4 w-4" />
            <span className="text-sm font-medium">ייצוא</span>
          </>
        )}
      </Button>
    </div>
  )
}

export default ExportExcelButton
