'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as XLSX from 'xlsx'

export function FileUpload({ onUploadAction }: { onUploadAction: (data: any[]) => void }) {
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = () => {
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(worksheet)
        onUploadAction(json)
      }
      reader.readAsArrayBuffer(file)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <Input type="file" onChange={handleFileChange} accept=".xlsx, .xls" />
      <Button onClick={handleUpload} disabled={!file}>
        העלאה
      </Button>
    </div>
  )
}
