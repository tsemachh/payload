'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

interface ReportApprovalUploadProps {
  formData: any
  setFormDataAction: (data: any) => void
  saveDraftDataAction: (label: string, data: any) => void
}

export function ReportApprovalUpload({
  formData,
  setFormDataAction,
  saveDraftDataAction,
}: ReportApprovalUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedDoc, setUploadedDoc] = useState<any>(null)

  // If formData already has a reportApproval (editing existing vote), show it
  useEffect(() => {
    if (formData?.reportApproval) {
      setUploadedDoc(formData.reportApproval)
    }
  }, [formData?.reportApproval])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)

      const res = await fetch('/api/documents', { method: 'POST', body: formDataUpload })
      if (!res.ok) throw new Error(await res.text())
      const result = await res.json()
      const doc = result.doc

      setUploadedDoc(doc)
      const updatedForm = { ...formData, reportApproval: doc }
      setFormDataAction(updatedForm)
      saveDraftDataAction('reportApproval', updatedForm)
    } catch (err) {
      console.error('שגיאה בהעלאת קובץ:', err)
    } finally {
      e.target.value = ''
    }
  }

  const removeFile = () => {
    setUploadedDoc(null)
    const updatedForm = { ...formData, reportApproval: null }
    setFormDataAction(updatedForm)
    saveDraftDataAction('reportApproval', updatedForm)
  }

  return (
    <div className="flex items-center space-x-4 space-x-reverse">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        className="hidden"
        onChange={handleFileChange}
        disabled={!formData.reported}
      />

      {/* Upload button */}
      <Button onClick={() => fileInputRef.current?.click()} disabled={!formData.reported}>
        העלה אישור הצבעה בפועל
      </Button>

      {/* Show uploaded file with remove option */}
      {uploadedDoc && (
        <div className="flex items-center gap-2">
          <a
            href={uploadedDoc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px] underline"
          >
            {uploadedDoc.filename}
          </a>

          <Button size="sm" variant="ghost" onClick={removeFile}>
            X
          </Button>
        </div>
      )}
    </div>
  )
}
