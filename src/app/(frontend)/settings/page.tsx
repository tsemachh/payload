'use client'
import { Loader2, Palette, Plus, Trash, Edit2, X, Check } from 'lucide-react'
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
import { postWithErrorHandling } from '../helpers/fetch-helpers'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

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
  const [selectedStocksIds, setSelectedStocksIds] = useState<string[]>([])
  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([])
  const [stocks, setStocks] = useState<{ id: string; name: string; stockId: string }[]>([])
  const [loadingStocks, setLoadingStocks] = useState(true)
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
  const [loadingTags, setLoadingTags] = useState(false)
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [stockSelectorResetTrigger, setStockSelectorResetTrigger] = useState(0)
  const [selectedLabel, setSelectedLabel] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTag, setEditingTag] = useState<any>(null)
  const [editingSelectedComIds, setEditingSelectedComIds] = useState<string[]>([])
  const [editingSelectedStocksIds, setEditingSelectedStocksIds] = useState<string[]>([])
  const [editingLabel, setEditingLabel] = useState<string>('')
  const [editingColor, setEditingColor] = useState<string>('')
  const [isUpdatingTag, setIsUpdatingTag] = useState(false)
  const [editStockSelectorResetTrigger, setEditStockSelectorResetTrigger] = useState(0)
  const { toast } = useToast()
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
    if (!companyIds || companyIds.length === 0) {
      console.log('ℹ️ No companies to delete tag from – skipping')
      return
    }

    setDeletingTagId(tagId)
    try {
      const data = await postWithErrorHandling('/api/companies/deleteLabel', {
        action: 'delete',
        companyIds,
        tagColor,
        tagLabel,
        labelId: tagId,
      })

      setTags((prev) => prev.filter((tag) => tag.id !== tagId))
      toast({
        title: '✅ בוצע בהצלחה',
        description: 'התגית נמחקה',
        duration: 1500,
      })
    } catch (error) {
      console.error('❌ Error deleting tag:', error)
      toast({
        title: '❌ שגיאה',
        description: 'שגיאה במחיקת התגית',
        duration: 1500,
      })
    } finally {
      setDeletingTagId(null)
    }
  }

  const handleEditTag = (tag: any) => {
    const uniqueCompanyIds = Array.from(new Set(tag.allCompanyIdsForLabel || [])) as string[]
    const stockIds = tag.stock ? tag.stock.map((s: any) => s.id) : []
    const color = tag.color
    const label = tag.label
    setEditingTagId(tag.id)
    setEditingTag({
      label: tag.label,
      color: tag.color,
      text: tag.text || '',
      stocks: stockIds,
    })
    setEditingSelectedComIds(uniqueCompanyIds || [])
    setSelectedStocksIds(stockIds)
    setEditStockSelectorResetTrigger((prev) => prev + 1)
    setEditingLabel(tag.label)
    setEditingColor(tag.color)
    setSelectedLabel(label)
    setSelectedColor(color)
  }

  const handleCancelEdit = () => {
    setEditingTagId(null)
    setEditingTag(null)
    setEditingSelectedComIds([])
    setSelectedStocksIds([])
    setEditingLabel('')
    setEditingColor('')
    setSelectedLabel('')
    setSelectedColor('')
  }

  const handleSaveEdit = async () => {
    if (!editingLabel || !editingColor) {
      toast({
        title: '⚠️ שגיאה',
        description: 'יש למלא את כל השדות',
        duration: 1500,
      })
      return
    }

    setIsUpdatingTag(true)
    try {
      const result = await postWithErrorHandling('/api/companies/updateLabel', {
        labelId: editingTagId,
        label: editingLabel,
        color: editingColor,
        companyIds: editingSelectedComIds,
        stocks: editingTag.stocks,
        prevComp: selectedComIds,
        prevStocks: selectedStocksIds,
        prevColor: selectedColor,
        prevLabel: selectedLabel,
      })
      const stockObjects = (editingTag.stocks || []).map((stockId: any) => {
        const stock = stocks.find((s) => s.id === stockId)
        return {
          id: stock?.id || stockId,
          stockId: stock?.stockId || stockId,
          name: stock?.name || '',
        }
      })

      const selectedCompanyNames = companies
        .filter((c) => editingSelectedComIds.includes(c.id))
        .map((c) => c.name)

      setTags((prev) =>
        prev.map((tag) =>
          tag.id === editingTagId
            ? {
                ...tag,
                label: editingLabel,
                color: editingColor,
                stock: stockObjects,
                allCompaniesForLabel: selectedCompanyNames,
                allCompanyIdsForLabel: editingSelectedComIds,
              }
            : tag,
        ),
      )

      toast({
        title: '✅ בוצע בהצלחה',
        description: 'התגית עודכנה',
        duration: 1500,
      })

      handleCancelEdit()
    } catch (error) {
      console.error('❌ Error updating tag:', error)
      toast({
        title: '❌ שגיאה',
        description: 'שגיאה בעדכון התגית',
        duration: 1500,
      })
    } finally {
      setIsUpdatingTag(false)
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
      if (!companies || companies.length === 0) {
        setTags([])
        setLoadingTags(false)
        return
      }

      setLoadingTags(true)
      setTags([])
      try {
        const data = await postWithErrorHandling('/api/companies/getLabels', {
          companyIds: companies,
        })

        const allTags = data.results.flatMap((c: any) =>
          (c.labels || []).map((lbl: any) => {
            const companyName =
              companies.find((comp) => comp.id === c.companyId)?.name || c.companyId
            const allCompaniesForLabel = [
              companyName,
              ...(lbl.companiesWithSameLabel?.map((comp: any) => comp.name) || []),
            ].filter((v, i, a) => a.indexOf(v) === i)
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

  const getEditStocksSelectSummary = () => {
    if (!editingTag?.stocks || editingTag.stocks.length === 0) {
      return 'בחר נייר ערך'
    }
    if (editingTag.stocks.length === 1) {
      const stock = stocks.find((s) => s.id === editingTag.stocks[0])
      return stock ? stock.name : 'נייר ערך'
    }
    return `  ${editingTag.stocks.length} ניירות ערך נבחרו   `
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

  const getEditCompanySelectSummary = () => {
    if (editingSelectedComIds.length === 0) {
      return 'בחר חברה'
    }
    const totalCompaniesIds = companiesWithFunds.map((company) => company?.id)
    const allSelected =
      editingSelectedComIds.length === totalCompaniesIds.length &&
      editingSelectedComIds.every((id) => totalCompaniesIds.includes(id))
    if (allSelected) {
      return 'נבחרו כל החברות'
    }
    return `נבחרו ${editingSelectedComIds.length} חברות`
  }

  const handleFundsSelectionChange = (selected: string[]) => {
    const matchedCompanies = companiesWithFunds.filter((company) => selected.includes(company.id))
    const fundsIds = matchedCompanies.flatMap((company) => company.funds).map((fund) => fund.id)

    setSelectedFundIds(fundsIds)
    setSelectedComIds(selected)
    setCurrentTag({ ...currentTag, companies: selected })
    setValidationErrors((prev) => prev.filter((err) => err !== 'companies'))
  }

  const handleStocksSelectionChange = (selected: string[]) => {
    setSelectedStocksIds(selected)
    setCurrentTag({ ...currentTag, stocks: selected })
  }

  const handleEditStocksSelectionChange = (selected: string[]) => {
    setEditingSelectedStocksIds(selected)
    setEditingTag({ ...editingTag, stocks: selected })
  }

  const handleEditFundsSelectionChange = (selected: string[]) => {
    setEditingSelectedComIds(selected)
  }

  const createTag = async () => {
    if (selectedLabel && selectedColor) {
      const duplicateTag = tags.find(
        (tag) =>
          tag.label.trim().toLowerCase() === selectedLabel.trim().toLowerCase() &&
          tag.color === selectedColor,
      )
      if (duplicateTag) {
        toast({
          title: '⚠️ שגיאה',
          description: 'תגית עם אותו שם וצבע כבר קיימת!',
          duration: 1500,
        })
        return
      }

      setIsCreatingTag(true)
      try {
        const result = await postWithErrorHandling(`/api/companies/createLabel`, {
          companyIds: selectedComIds,
          label: selectedLabel,
          color: selectedColor,
          stocks: currentTag.stocks,
        })

        const stockObjects = (currentTag.stocks || []).map((stockId: any) => {
          const stock = stocks.find((s) => s.id === stockId)
          return {
            id: stock?.id || stockId,
            stockId: stock?.stockId || stockId,
            name: stock?.name || '',
          }
        })

        const selectedCompanyNames = companies
          .filter((c) => selectedComIds.includes(c.id))
          .map((c) => c.name)
        const newTag = {
          id: result.results[0].updatedCompany.label.labels.at(-1).id,
          label: selectedLabel,
          color: selectedColor,
          text: currentTag.text || '',
          companies: currentTag.companies || [],
          stock: stockObjects,
          allCompaniesForLabel: selectedCompanyNames,
          allCompanyIdsForLabel: selectedComIds,
        }

        setTags([...tags, newTag])

        const allCompanyIds = companiesWithFunds.map((company) => company.id)
        const allFundIds = companiesWithFunds
          .flatMap((company) => company.funds)
          .map((fund) => fund.id)

        setCurrentTag({ label: '', color: '', text: '', companies: allCompanyIds, stocks: [] })
        setSelectedComIds(allCompanyIds)
        setSelectedFundIds(allFundIds)
        setSelectedStocksIds([])
        setSelectedLabel('')
        setSelectedColor('')
        setStockSelectorResetTrigger((prev) => prev + 1)
        toast({
          title: '✅ בוצע בהצלחה',
          description: 'התגית נוצרה',
          duration: 1500,
        })
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
                  value={selectedLabel || ''}
                  onChange={(e) => setSelectedLabel(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Tag Color */}
              <div className="space-y-2">
                <Label htmlFor="tag-color">צבע</Label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger className="w-full flex-row-reverse justify-between text-right h-9">
                    <SelectValue placeholder="בחר צבע">
                      {selectedColor && (
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full ${colorClasses[selectedColor]}`} />
                          {colorLabels[selectedColor]}
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
                      checkActive={false}
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
                      selectedStocks={selectedStocksIds || []}
                      onSelectionChangeAction={handleStocksSelectionChange}
                      className="w-full"
                      isLoading={loadingStocks}
                      resetTrigger={stockSelectorResetTrigger}
                    />
                  </SelectContent>
                </Select>
                {validationErrors.includes('stocks') && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button
                onClick={createTag}
                disabled={
                  !selectedLabel ||
                  !selectedColor ||
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
            <CardDescription>רשימת התגיות שיצרת. ניתן לערוך או למחוק אותן.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTags ? (
              <p>טוען תגיות...</p>
            ) : tags.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">אין תגיות קיימות עדיין.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">צבע</TableHead>
                        <TableHead className="text-right">תוית</TableHead>
                        <TableHead className="text-right">ניירות ערך</TableHead>
                        <TableHead className="text-right">חברות</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
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
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={deletingTagId !== null} 
                                onClick={() => handleEditTag(tag)}
                                className="h-8 w-8 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={deletingTagId !== null} 
                                onClick={() => {
                                  handleDeleteTag(
                                    tag.id,
                                    tag.color,
                                    tag.label,
                                    tag.allCompanyIdsForLabel,
                                  )
                                }}
                                className="h-8 w-8 hover:bg-muted hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingTagId === tag.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {editingTagId && editingTag && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>עריכת תגית</CardTitle>
                  <CardDescription>ערוך את פרטי התגית</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancelEdit}
                  disabled={isUpdatingTag}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Edit Tag label */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-tag-label">שם התגית</Label>
                    <Input
                      id="edit-tag-label"
                      placeholder="שם התגית"
                      value={editingLabel || ''}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      className="h-9"
                      disabled={isUpdatingTag}
                    />
                  </div>
                  {/* Edit Tag Color */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-tag-color">צבע</Label>
                    <Select
                      value={editingColor}
                      onValueChange={setEditingColor}
                      disabled={isUpdatingTag}
                    >
                      <SelectTrigger className="w-full flex-row-reverse justify-between text-right h-9">
                        <SelectValue placeholder="בחר צבע">
                          {editingColor && (
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded-full ${colorClasses[editingColor]}`}
                              />
                              {colorLabels[editingColor]}
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
                  {/* Edit Companies */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-companies">חברות</Label>
                    <Select>
                      <SelectTrigger className="w-full flex-row-reverse justify-between text-right h-9">
                        <SelectValue placeholder={getEditCompanySelectSummary()} />
                      </SelectTrigger>
                      <SelectContent align="end" dir="rtl" className="p-0">
                        <CompanyTreeSelector
                          selectedCompanies={editingSelectedComIds}
                          onSelectionChangeAction={handleEditFundsSelectionChange}
                          className="w-full"
                          showSearch={false}
                          allCompaniesIds={companiesWithFunds.map((company) => company?.id)}
                          showFunds={false}
                          checkActive={false}
                        />
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Edit Stocks */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-stocks">ניירות ערך</Label>
                    <Select
                      onOpenChange={(open) => {
                        if (!open) {
                          setEditStockSelectorResetTrigger((prev) => prev + 1)
                        }
                      }}
                    >
                      <SelectTrigger className="w-full flex-row-reverse justify-between text-right h-9">
                        <SelectValue placeholder={getEditStocksSelectSummary()} />
                      </SelectTrigger>
                      <SelectContent align="end" dir="rtl" className="p-0">
                        <StockSelector
                          stocks={stocks}
                          selectedStocks={editingTag.stocks || []}
                          onSelectionChangeAction={handleEditStocksSelectionChange}
                          className="w-full"
                          isLoading={loadingStocks}
                          resetTrigger={editStockSelectorResetTrigger}
                        />
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleCancelEdit} disabled={isUpdatingTag}>
                    ביטול
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={
                      !editingLabel ||
                      !editingColor ||
                      !editingTag?.stocks?.length ||
                      !editingSelectedComIds?.length ||
                      isUpdatingTag
                    }
                  >
                    {isUpdatingTag ? (
                      <>
                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                        שומר...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 ml-2" />
                        שמור
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Toaster />
      </div>
    </div>
  )
}
