"use client"

import { Button } from "@/components/ui/button"

export function ExportButton({ data, filename }: { data: any[]; filename: string }) {
  const handleExport = () => {
    // Convert data to CSV
    const headers = Object.keys(data[0]).join(",")
    const csv = [headers, ...data.map((row) => Object.values(row).join(","))].join("\n")

    // Create a Blob with the CSV data
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })

    // Create a download link and trigger the download
    const link = document.createElement("a")
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `${filename}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return <Button onClick={handleExport}>ייצוא לCSV</Button>
}

