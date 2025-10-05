'use client'
import { Trash, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import { X, Plus, Palette } from 'lucide-react'
import { CompanyTreeSelector } from '../holdings/components/CompanySelector'
import { useCompaniesContext } from '../context/companiesContext'
import type { CompanyWithFunds, Fund } from '../participations/page'
import { cn } from '@/lib/utils'
import { StockSelector } from '../holdings/components/StockSelector'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { colorClasses } from '../helpers/maps'

const colorLabels: Record<string, string> = {
  red: 'אדום',
  blue: 'כחול',
  green: 'ירוק',
  yellow: 'צהוב',
  purple: 'סגול',
  pink: 'ורוד',
  orange: 'כתום',
  teal: 'טורקיז',
  gray: 'אפור',
  black: 'שחור',
}

export default function SettingsPage() {
  const { companies, funds } = useCompaniesContext()
  const [tags, setTags] = useState<any[]>([])
  const [currentTag, setCurrentTag] = useState<any>({
    label: '',
    color: '',
    text: '',
    companies: [],
    stocks: [],
  })
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [selectedComIds, setSelectedComIds] = useState<string[]>([])
  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([])
  const [stocks, setStocks] = useState<{ id: string; name: string; stockId: string }[]>([])
  const [loadingStocks, setLoadingStocks] = useState(true)
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
  const [loadingTags, setLoadingTags] = useState(false)
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [stockSelectorResetTrigger, setStockSelectorResetTrigger] = useState(0)

  // --- Fetch stocks from endpoint ---
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch('/api/stocks/tradable')
        const data = await res.json()
        setStocks(data.stocks || [])
      } catch (err) {
        console.error('❌ Failed to load stocks:', err)
      } finally {
        setLoadingStocks(false)
      }
    }
    fetchStocks()
  }, [])

  const handleDeleteTag = async (
    tagId: string,
    tagColor: string,
    tagLabel: string,
    companyIds: string[],
  ) => {
    setDeletingTagId(tagId)
    try {
      const response = await fetch('/api/companies/deleteLabel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          companyIds,
          tagColor,
          tagLabel,
          labelId: tagId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete tag')
      }

      setTags((prev) => prev.filter((tag) => tag.id !== tagId))
    } catch (error) {
      console.error('❌ Error deleting tag:', error)
    } finally {
      setDeletingTagId(null)
    }
  }

  const companiesWithFunds: CompanyWithFunds[] = useMemo(() => {
    const companyMap = new Map<string, CompanyWithFunds>(
      companies.map((company) => [company.id, { ...company, funds: [] }]),
    )

    funds.forEach((fund) => {
      if (!fund.parentCompany) return
      const company = companyMap.get(fund.parentCompany)
      if (company) {
        company.funds.push(fund as Fund)
      }
    })

    return Array.from(companyMap.values())
  }, [companies, funds])
  useEffect(() => {
    if (companiesWithFunds.length > 0 && selectedComIds.length === 0) {
      const allCompanyIds = companiesWithFunds.map((company) => company.id)
      const allFundIds = companiesWithFunds
        .flatMap((company) => company.funds)
        .map((fund) => fund.id)

      setSelectedComIds(allCompanyIds)
      setSelectedFundIds(allFundIds)
      setCurrentTag((prev: any) => ({ ...prev, companies: allCompanyIds }))
    }
  }, [companiesWithFunds])
  useEffect(() => {
    const fetchTags = async () => {
      setLoadingTags(true)
      setTags([])
      try {
        const response = await fetch('/api/companies/getLabels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyIds: companies }),
        })
        const data = await response.json()
        if (response.ok) {
          const allTags = data.results.flatMap((c: any) =>
            (c.labels || []).map((lbl: any) => {
              const companyName =
                companies.find((comp) => comp.id === c.companyId)?.name || c.companyId
              const allCompaniesForLabel = [
                companyName,
                ...(lbl.companiesWithSameLabel?.map((comp: any) => comp.name) || []),
              ]
              const allCompanyIdsForLabel = [
                c.companyId,
                ...(lbl.companiesWithSameLabel?.map((comp: any) => comp.id) || []),
              ]
              const stocksWithStockId = (lbl.stocks || []).map((s: any) => ({
                id: s.id,
                stockId: s.stockId,
              }))

              return {
                ...lbl,
                companyId: c.companyId,
                allCompaniesForLabel,
                allCompanyIdsForLabel,
                stocks: stocksWithStockId,
              }
            }),
          )
          const uniqueTags: any[] = []
          const seen = new Set()

          for (const tag of allTags) {
            const key = `${tag.label}-${tag.color}-${tag.stocks}`
            if (!seen.has(key)) {
              seen.add(key)
              uniqueTags.push(tag)
            }
          }
          setTags(uniqueTags)
        } else {
          console.error('❌ Failed to fetch tags:', data.error)
        }
      } catch (err) {
        console.error('❌ fetchTags error:', err)
      } finally {
        setLoadingTags(false)
      }
    }

    fetchTags()
  }, [companies])

  const getStocksSelectSummary = () => {
    if (!currentTag.stocks || currentTag.stocks.length === 0) {
      return 'בחר נייר ערך'
    }
    if (currentTag.stocks.length === 1) {
      const stock = stocks.find((s) => s.id === currentTag.stocks[0])
      return stock ? stock.name : 'נייר ערך'
    }
    return `  ${currentTag.stocks.length} ניירות ערך נבחרו   `
  }

  const getCompanySelectSummary = () => {
    if (selectedComIds.length === 0) {
      return 'בחר חברה'
    }
    const totalCompaniesIds = companiesWithFunds.map((company) => company?.id)
    const allSelected =
      selectedComIds.length === totalCompaniesIds.length &&
      selectedComIds.every((id) => totalCompaniesIds.includes(id))

    if (allSelected) {
      return 'נבחרו כל החברות'
    }

    return `נבחרו ${selectedComIds.length} חברות`
  }

  const handleFundsSelectionChange = (selected: string[]) => {
    const matchedCompanies = companiesWithFunds.filter((company) => selected.includes(company.id))
    const fundsIds = matchedCompanies.flatMap((company) => company.funds).map((fund) => fund.id)

    setSelectedFundIds(fundsIds)
    setSelectedComIds(selected)
    setCurrentTag({ ...currentTag, companies: selected })
    setValidationErrors((prev) => prev.filter((err) => err !== 'companies'))
  }

  const createTag = async () => {
    if (currentTag.label && currentTag.color) {
      setIsCreatingTag(true)
      try {
        const response = await fetch(`/api/companies/createLabel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyIds: selectedComIds,
            label: currentTag.label,
            color: currentTag.color,
            stocks: currentTag.stocks,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          console.error('❌ Failed to create tag:', result.error)
          return
        }

        const stockObjects = (currentTag.stocks || []).map((stockId: any) => {
          const stock = stocks.find((s) => s.id === stockId)
          return { stockId: stock?.stockId || stockId }
        })

        const selectedCompanyNames = companies
          .filter((c) => selectedComIds.includes(c.id))
          .map((c) => c.name)

        const newTag = {
          id: result.id,
          label: currentTag.label,
          color: currentTag.color,
          text: currentTag.text || '',
          companies: currentTag.companies || [],
          stock: stockObjects,
          allCompaniesForLabel: selectedCompanyNames,
        }

        setTags([...tags, newTag])

        setCurrentTag({ label: '', color: '', text: '', companies: [], stocks: [] })
        setSelectedComIds([])
        setSelectedFundIds([])
      } catch (error) {
        console.error('❌ Error creating tag:', error)
      } finally {
        setIsCreatingTag(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Palette className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">יצירת תגית חדשה</h1>
            <p className="text-muted-foreground">צור תגיות מותאמות אישית עם הגדרות ייחודיות</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {/* Tag label */}
              <div className="space-y-2">
                <Label htmlFor="tag-label">שם התגית</Label>
                <Input
                  id="tag-label"
                  placeholder="שם התגית"
                  value={currentTag.label || ''}
                  onChange={(e) => setCurrentTag({ ...currentTag, label: e.target.value })}
                  className="h-9"
                />
              </div>

              {/* Tag Color */}
              <div className="space-y-2">
                <Label htmlFor="tag-color">צבע</Label>
                <Select
                  value={currentTag.color}
                  onValueChange={(value) => setCurrentTag({ ...currentTag, color: value })}
                >
                  <SelectTrigger className="w-full flex-row-reverse justify-between text-right h-9">
                    <SelectValue placeholder="בחר צבע">
                      {currentTag.color && (
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`}
                          />
                          {colorLabels[currentTag.color]}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end" dir="rtl">
                    {Object.entries(colorLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full ${colorClasses[value]}`} />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Companies */}
              <div className="space-y-2">
                <Label htmlFor="companies">חברות</Label>
                <Select>
                  <SelectTrigger
                    className={cn(
                      'w-full flex-row-reverse justify-between text-right h-9',
                      validationErrors.includes('companies') &&
                        'border-red-500 ring-1 ring-red-500',
                    )}
                  >
                    <SelectValue placeholder={getCompanySelectSummary()} />
                  </SelectTrigger>
                  <SelectContent align="end" dir="rtl" className="p-0">
                    <CompanyTreeSelector
                      selectedCompanies={selectedComIds}
                      onSelectionChangeAction={handleFundsSelectionChange}
                      className="w-full"
                      showSearch={false}
                      allCompaniesIds={companiesWithFunds.map((company) => company?.id)}
                      showFunds={false}
                    />
                  </SelectContent>
                </Select>
                {validationErrors.includes('companies') && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Stocks */}
              <div className="space-y-2">
                <Label htmlFor="stocks">ניירות ערך</Label>
                {
                  <Select
                    onOpenChange={(open) => {
                      if (!open) {
                        setStockSelectorResetTrigger((prev) => prev + 1)
                      }
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        'w-full flex-row-reverse justify-between text-right h-9',
                        validationErrors.includes('stocks') && 'border-red-500 ring-1 ring-red-500',
                      )}
                    >
                      <SelectValue placeholder={getStocksSelectSummary()} />
                    </SelectTrigger>
                    <SelectContent align="end" dir="rtl" className="p-0">
                      <StockSelector
                        stocks={stocks}
                        selectedStocks={currentTag.stocks || []}
                        onSelectionChange={(newSelection) =>
                          setCurrentTag({ ...currentTag, stocks: newSelection })
                        }
                        className="w-full"
                        isLoading={loadingStocks}
                        resetTrigger={stockSelectorResetTrigger}
                      />
                    </SelectContent>
                  </Select>
                }
                {validationErrors.includes('stocks') && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={createTag}
                disabled={
                  !currentTag.label ||
                  !currentTag.color ||
                  !currentTag.stocks?.length ||
                  !currentTag.companies?.length ||
                  isCreatingTag
                }
              >
                {isCreatingTag ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    יוצר תגית...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 ml-2" />
                    צור תגית
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing Tags Section */}
        <Card>
          <CardHeader>
            <CardTitle>תגיות קיימות</CardTitle>
            <CardDescription>רשימת התגיות שיצרת. ניתן למחוק אותן.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTags ? (
              <p>טוען תגיות...</p>
            ) : tags.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">אין תגיות קיימות עדיין.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">צבע</TableHead>
                      <TableHead className="text-right">תוית</TableHead>
                      <TableHead className="text-right">ניירות ערך</TableHead>
                      <TableHead className="text-right">חברות</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tags.map((tag) => (
                      <TableRow key={tag.id}>
                        {/* Color Column */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full ${colorClasses[tag.color]}`} />
                            <span className="text-sm text-muted-foreground">
                              {colorLabels[tag.color]}
                            </span>
                          </div>
                        </TableCell>

                        {/* Label Column */}
                        <TableCell>
                          <span className="font-medium">{tag.label}</span>
                        </TableCell>

                        {/* Stocks Column */}
                        <TableCell>
                          {tag.stock && tag.stock.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tag.stock.map((stock: any, index: number) => (
                                <TooltipProvider key={index}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="secondary" className="text-xs">
                                        {stock.stockId}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>{stock.name}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">אין ניירות ערך</span>
                          )}
                        </TableCell>

                        {/* Companies Column */}
                        <TableCell>
                          {tag.allCompaniesForLabel &&
                          Array.isArray(tag.allCompaniesForLabel) &&
                          tag.allCompaniesForLabel.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tag.allCompaniesForLabel.map((companyName: any, index: any) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {companyName}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">אין חברות</span>
                          )}
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDeleteTag(
                                tag.id,
                                tag.color,
                                tag.label,
                                tag.allCompanyIdsForLabel,
                              )
                            }
                            className="h-8 w-8 hover:bg-muted"
                          >
                            {deletingTagId === tag.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
