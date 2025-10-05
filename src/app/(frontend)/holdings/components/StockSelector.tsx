'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface Stock {
  id: string
  name: string
  stockId: string
}

interface StockSelectorProps {
  stocks: Stock[]
  selectedStocks: string[]
  onSelectionChange: (selected: string[]) => void
  className?: string
  isLoading?: boolean
  resetTrigger?: number
}

export function StockSelector({
  stocks,
  selectedStocks,
  onSelectionChange,
  className,
  isLoading = false,
  resetTrigger,
}: StockSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>(stocks)
  useEffect(() => {
    setSearchQuery('')
  }, [resetTrigger])
  useEffect(() => {
    if (!searchQuery) {
      setFilteredStocks(stocks)
    } else {
      setFilteredStocks(
        stocks.filter(
          (stock) =>
            stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stock.stockId.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      )
    }
  }, [searchQuery, stocks])

  const handleToggle = (stockId: string) => {
    let newSelection: string[]
    if (selectedStocks.includes(stockId)) {
      newSelection = selectedStocks.filter((id) => id !== stockId)
    } else {
      newSelection = [...selectedStocks, stockId]
    }
    onSelectionChange(newSelection)
  }

  return (
    <div className={cn(className)} dir="rtl">
      <div className="relative border rounded-md p-2">
        {/* שדה חיפוש */}
        <div className="mb-2">
          <input
            type="text"
            placeholder="חפש נייר ערך..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 px-2 text-sm bg-transparent border border-gray-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
            disabled={isLoading}
          />
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-sm text-gray-500">טוען...</div>
        ) : filteredStocks.length > 0 ? (
          <div className="space-y-1">
            {filteredStocks.map((stock) => (
              <div
                key={stock.id}
                className="flex items-center px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer gap-2"
                onClick={() => handleToggle(stock.id)}
              >
                <Checkbox
                  id={`stock-${stock.id}`}
                  checked={selectedStocks.includes(stock.id)}
                  onCheckedChange={() => handleToggle(stock.id)}
                  className="h-3.5 w-3.5"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="truncate">
                  {stock.name} – {stock.stockId}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-gray-500">
            לא נמצאו ניירות ערך התואמים לחיפוש.
          </div>
        )}
      </div>
    </div>
  )
}
