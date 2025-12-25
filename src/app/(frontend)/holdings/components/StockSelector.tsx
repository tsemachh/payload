'use client'

import { useEffect, useState } from 'react'
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
  onSelectionChangeAction: (selected: string[]) => void
  className?: string
  isLoading?: boolean
  resetTrigger?: number
}

function fuzzyMatch(text: string, query: string): { matches: boolean; score: number } {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return { matches: true, score: 0 }

  const clean = (str: string) => str.toLowerCase().replace(/[^a-zA-Z0-9א-ת]/g, '')

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
  onSelectionChangeAction,
  className,
  isLoading = false,
  resetTrigger,
}: StockSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>(stocks || [])
  const [recentlyToggled, setRecentlyToggled] = useState<string | null>(null)

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

    // Sort selected items to top, but maintain order within each group
    const selectedItems = result.filter(stock => selectedStocks.includes(stock.id))
    const unselectedItems = result.filter(stock => !selectedStocks.includes(stock.id))
    
    setFilteredStocks([...selectedItems, ...unselectedItems])
  }, [searchQuery, stocks, selectedStocks])

  const handleToggle = (stockId: string) => {
    let newSelection: string[]
    if (selectedStocks.includes(stockId)) {
      newSelection = selectedStocks.filter((id) => id !== stockId)
    } else {
      newSelection = [...selectedStocks, stockId]
    }
    
    // Add visual feedback for the toggled item
    setRecentlyToggled(stockId)
    setTimeout(() => setRecentlyToggled(null), 600)
    
    onSelectionChangeAction(newSelection)
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
          <div className="max-h-64 overflow-y-auto">
            {/* Selected items section */}
            {filteredStocks.filter(stock => selectedStocks.includes(stock.id)).length > 0 && (
              <div className="space-y-0.5 mb-2">
                {filteredStocks
                  .filter(stock => selectedStocks.includes(stock.id))
                  .map((stock) => {
                    const isRecentlyToggled = recentlyToggled === stock.id
                    
                    return (
                      <div
                        key={stock.id}
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md cursor-pointer gap-3 transition-all duration-500 ease-in-out transform",
                          "hover:bg-gray-50 border border-transparent hover:border-gray-200",
                          isRecentlyToggled && "scale-[1.02] shadow-md"
                        )}
                        onClick={() => handleToggle(stock.id)}
                      >
                        <Checkbox
                          id={`stock-selected-${stock.id}`}
                          checked={true}
                          onCheckedChange={() => handleToggle(stock.id)}
                          className="h-4 w-4 transition-all duration-200"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="flex-1 truncate transition-all duration-300 text-gray-700">
                          {stock.name} – {stock.stockId}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {isRecentlyToggled && (
                            <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
            
            {/* Separator line if there are both selected and unselected items */}
            {filteredStocks.filter(stock => selectedStocks.includes(stock.id)).length > 0 && 
             filteredStocks.filter(stock => !selectedStocks.includes(stock.id)).length > 0 && (
              <div className="border-t border-gray-200 my-2"></div>
            )}
            
            {/* Unselected items section */}
            <div className="space-y-0.5">
              {filteredStocks
                .filter(stock => !selectedStocks.includes(stock.id))
                .map((stock) => {
                  const isRecentlyToggled = recentlyToggled === stock.id
                  
                  return (
                    <div
                      key={stock.id}
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md cursor-pointer gap-3 transition-all duration-500 ease-in-out transform",
                        "hover:bg-gray-50 border border-transparent hover:border-gray-200",
                        isRecentlyToggled && "scale-[1.02] shadow-md"
                      )}
                      onClick={() => handleToggle(stock.id)}
                    >
                      <Checkbox
                        id={`stock-unselected-${stock.id}`}
                        checked={false}
                        onCheckedChange={() => handleToggle(stock.id)}
                        className="h-4 w-4 transition-all duration-200"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="flex-1 truncate transition-all duration-300 text-gray-700">
                        {stock.name} – {stock.stockId}
                      </span>
                      
                      {isRecentlyToggled && (
                        <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                  )
                })}
            </div>
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
