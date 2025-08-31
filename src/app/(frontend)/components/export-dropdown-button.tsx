'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'

export type ExportFormat = 'pdf' | 'excel'

interface ExportFormatOption {
  value: ExportFormat
  label: string
  fileExtension: string
}

interface ExportDropdownButtonProps {
  onExportAction: (format: ExportFormat) => void
  isExporting: boolean
  disabled: boolean
  className?: string
}

const exportFormats: ExportFormatOption[] = [
  { value: 'pdf', label: 'ייצוא כקובץ PDF', fileExtension: 'pdf' },
  { value: 'excel', label: 'ייצוא כקובץ Excel', fileExtension: 'xlsx' },
]

export function ExportDropdownButton({
  onExportAction,
  isExporting,
  disabled,
  className = '',
}: ExportDropdownButtonProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf')

  const currentFormat = exportFormats.find((format) => format.value === selectedFormat)
  const buttonText = isExporting ? 'מייצא...' : currentFormat?.label || 'ייצוא כקובץ PDF'

  const handleFormatSelect = (format: ExportFormat) => {
    setSelectedFormat(format)
  }

  const handleExport = () => {
    onExportAction(selectedFormat)
  }

  return (
    <div className={`flex ${className}`}>
      {/* Main export button */}
      <Button
        onClick={handleExport}
        disabled={disabled || isExporting}
        variant="default"
        className="rounded-r-md rounded-l-none border-l-0 whitespace-nowrap h-10"
      >
        {buttonText}
      </Button>

      {/* Dropdown trigger */}
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild className="h-auto">
          <Button
            disabled={disabled || isExporting}
            variant="default"
            size="sm"
            className="rounded-r-none rounded-l-md px-2 border-r border-r-white/20"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40" align="start">
          {exportFormats.map((format) => (
            <DropdownMenuItem
              key={format.value}
              onClick={() => handleFormatSelect(format.value)}
              className="text-right cursor-pointer hover:bg-muted flex items-center justify-between"
            >
              <span>{format.label}</span>
              {selectedFormat === format.value && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
