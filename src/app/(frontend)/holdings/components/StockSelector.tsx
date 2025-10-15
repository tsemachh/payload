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

function fuzzyMatch(text: string, query: string): { matches: boolean; score: number } {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return { matches: true, score: 0 }

  const clean = (str: string) => str.toLowerCase().replace(/[^a-zA-Z0-9א-ת]/g, '') // מסיר רווחים וסימנים

  const cleanText = clean(text)
  const cleanQuery = clean(trimmedQuery)

  
  if (cleanText === cleanQuery) return { matches: true, score: 1000 }
  if (cleanText.startsWith(cleanQuery)) return { matches: true, score: 900 }
  if (cleanText.includes(cleanQuery)) return { matches: true, score: 800 }

  let textIndex = 0
  let queryIndex = 0
  const matchedPositions: number[] = []

  while (textIndex < cleanText.length && queryIndex < cleanQuery.length) {
    if (cleanText[textIndex] === cleanQuery[queryIndex]) {
      matchedPositions.push(textIndex)
      queryIndex++
    }
    textIndex++
  }

  if (queryIndex === cleanQuery.length) {
    let totalDistance = 0
    for (let i = 1; i < matchedPositions.length; i++) {
      totalDistance += matchedPositions[i] - matchedPositions[i - 1]
    }
    const avgDistance =
      matchedPositions.length > 1 ? totalDistance / (matchedPositions.length - 1) : 1
    const score = Math.max(100, 700 - avgDistance * 10)
    return { matches: true, score }
  }

  return { matches: false, score: 0 }
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
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>(stocks || [])

  useEffect(() => {
    setSearchQuery('')
  }, [resetTrigger])

  useEffect(() => {
    if (!stocks || stocks.length === 0) {
      setFilteredStocks([])
      return
    }

    let result = stocks

    if (searchQuery) {
      const stocksWithScores = stocks
        .map((stock) => {
          const nameMatch = fuzzyMatch(stock.name, searchQuery)
          const idMatch = fuzzyMatch(stock.stockId, searchQuery)

          // בחירת ההתאמה הטובה ביותר
          const bestMatch = nameMatch.score > idMatch.score ? nameMatch : idMatch

          return {
            stock,
            matches: bestMatch.matches,
            score: bestMatch.score,
          }
        })
        .filter((item) => item.matches)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.stock)

      result = stocksWithScores
    }

    const sortedResult = [...result].sort((a, b) => {
      const aSelected = selectedStocks.includes(a.id)
      const bSelected = selectedStocks.includes(b.id)

      if (aSelected && !bSelected) return -1
      if (!aSelected && bSelected) return 1
      return 0
    })

    setFilteredStocks(sortedResult)
  }, [searchQuery, stocks, selectedStocks])

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
