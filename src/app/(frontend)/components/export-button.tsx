'use client'

import { Button } from '@/components/ui/button'

export function ExportButton({ data, filename }: { data: any[]; filename: string }) {
  const handleExport = () => {
    // Convert data to CSV - extract only stockNumber, accountNumber, quantity in that order
    // Wrap values in quotes to force text format in Excel
    const headers = ['מספר נייר', 'כמות', 'מספר חשבון'].join(',')
    const rows = data.map((row) => [row.stockId, row.quantity, row.accountId].join(','))
    const csv = [headers, ...rows].join('\n')
    console.log(data)
    // Create a Blob with the CSV data and include UTF-8 BOM for Excel compatibility
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })

    // Create a download link and trigger the download
    const link = document.createElement('a')
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return <Button onClick={handleExport}>ייצוא </Button>
}
