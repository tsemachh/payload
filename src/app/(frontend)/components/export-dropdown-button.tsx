'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

export type ExportFormat = 'pdf' | 'excel'

interface ExportFormatOption {
  value: ExportFormat
  label: string
  fileExtension: string
}

interface ExportDropdownButtonProps {
  onExport: (format: ExportFormat) => void
  isExporting: boolean
  disabled: boolean
  className?: string
}

const exportFormats: ExportFormatOption[] = [
  { value: 'pdf', label: 'ייצוא כקובץ PDF', fileExtension: 'pdf' },
  { value: 'excel', label: 'ייצוא כקובץ Excel', fileExtension: 'xlsx' },
]

export function ExportDropdownButton({
  onExport,
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
    onExport(selectedFormat)
  }

  return (
    <div className={`flex ${className}`}>
      {/* Main export button */}
      <Button
        onClick={handleExport}
        disabled={disabled || isExporting}
        variant="default"
        className="rounded-r-md rounded-l-none border-l-0 whitespace-nowrap"
      >
        {buttonText}
      </Button>

      {/* Dropdown trigger */}
      <DropdownMenu>
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
        <DropdownMenuContent align="end">
          {exportFormats.map((format) => (
            <DropdownMenuItem
              key={format.value}
              onClick={() => handleFormatSelect(format.value)}
              className={`text-right ${selectedFormat === format.value ? 'bg-accent' : ''}`}
            >
              {format.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
