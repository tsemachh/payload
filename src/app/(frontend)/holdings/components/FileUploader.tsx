'use client'

import { useState, useRef } from 'react'
import { UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileUploaderProps {
  onFileChange: (file: File | null) => void
  className?: string
  disabled?: boolean
}

export function FileUploader({ onFileChange, className, disabled = false }: FileUploaderProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setFileName(file.name)
      onFileChange(file)
    } else {
      setFileName(null)
      onFileChange(null)
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setFileName(null)
    onFileChange(null)
  }

  return (
    <div className={className}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".csv,.xlsx,.xls"
        disabled={disabled}
      />
      <Button 
        variant="outline" 
        onClick={handleButtonClick}
        disabled={disabled}
        className="min-w-[240px] justify-between"
      >
        <span className="flex items-center">
          <UploadCloud className="ml-2 h-4 w-4" />
          {fileName || 'העלאת קובץ'}
        </span>
        {fileName && (
          <span 
            onClick={clearSelection}
            className="text-muted-foreground hover:text-foreground ml-2 cursor-pointer"
          >
            ×
          </span>
        )}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">
        ניתן להעלות קבצי CSV או Excel בלבד
      </p>
    </div>
  )
}
