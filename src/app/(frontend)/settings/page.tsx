"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { X, Plus, Palette } from "lucide-react"
import { ThemeChooser } from "../components/theme-chooser"
import { CompanyTreeSelector } from "../holdings/components/CompanySelector"
import { useCompaniesContext } from "../context/companiesContext"
import type { CompanyWithFunds, Fund } from "../participations/page"
import { cn } from "@/lib/utils"

interface CompanyNode {
  id: string
  name: string
  children?: CompanyNode[]
  selected: boolean
}
const colorClasses: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  gray: "bg-gray-500",
  black: "bg-black",
}

const colorLabels: Record<string, string> = {
  red: "אדום",
  blue: "כחול",
  green: "ירוק",
  yellow: "צהוב",
  purple: "סגול",
  pink: "ורוד",
  orange: "כתום",
  teal: "טורקיז",
  gray: "אפור",
  black: "שחור",
};

export default function SettingsPage() {
  const { companies, funds } = useCompaniesContext()
  const [tags, setTags] = useState<any[]>([])
  const [currentTag, setCurrentTag] = useState<any>({
    name: "",
    color: "",
    text: "",
    companies: [],
    securities: [],
  })
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [selectedComIds, setSelectedComdIds] = useState<string[]>([])
  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([])
  const securitiesOptions = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA", "NFLX", "BABA", "TCEHY"]
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
  const getCompanySelectSummary = () => {
    if (selectedComIds.length === 0) {
      return "בחר חברה"
    }
    const totalCompaniesIds = companiesWithFunds.map((company) => company?.id)
    const allSelected =
      selectedComIds.length === totalCompaniesIds.length && selectedComIds.every((id) => totalCompaniesIds.includes(id))

    if (allSelected) {
      return "נבחרו כל החברות"
    }

    return `נבחרו ${selectedComIds.length} חברות`
  }
  const handleFundsSelectionChange = (selected: string[]) => {
    const matchedCompanies = companiesWithFunds.filter((company) => selected.includes(company.id))
    const fundsIds = matchedCompanies.flatMap((company) => company.funds).map((fund) => fund.id)

    setSelectedFundIds(fundsIds)
    setSelectedComdIds(selected)
    setValidationErrors((prev) => prev.filter((err) => err !== "companies"))
  }

  const toggleCompanySelection = (nodeId: string, parentId?: string) => {
    // Implementation for toggling company selection in tree
    const selectedCompanies = currentTag.companies || []
    const isSelected = selectedCompanies.includes(nodeId)

    if (isSelected) {
      setCurrentTag({
        ...currentTag,
        companies: selectedCompanies.filter((id:any) => id !== nodeId),
      })
    } else {
      setCurrentTag({
        ...currentTag,
        companies: [...selectedCompanies, nodeId],
      })
    }
  }

  const toggleSecurity = (security: string) => {
    const selectedSecurities = currentTag.securities || []
    const isSelected = selectedSecurities.includes(security)

    if (isSelected) {
      setCurrentTag({
        ...currentTag,
        securities: selectedSecurities.filter((s:any) => s !== security),
      })
    } else {
      setCurrentTag({
        ...currentTag,
        securities: [...selectedSecurities, security],
      })
    }
  }

  const createTag = () => {
    if (currentTag.name && currentTag.color) {
      const newTag = {
        id: Date.now().toString(),
        name: currentTag.name,
        color: currentTag.color,
        text: currentTag.text || "",
        companies: currentTag.companies || [],
        securities: currentTag.securities || [],
      }
      setTags([...tags, newTag])
      setCurrentTag({
        name: "",
        color: "primary",
        text: "",
        companies: [],
        securities: [],
      })
    }
  }

  const removeTag = (tagId: string) => {
    setTags(tags.filter((tag) => tag.id !== tagId))
  }

  const renderCompanyTree = (nodes: any[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.id} className={`${level > 0 ? "mr-4" : ""}`}>
        <div className="flex items-center space-x-2 py-1">
          <Checkbox
            id={node.id}
            checked={currentTag.companies?.includes(node.id) || false}
            onCheckedChange={() => toggleCompanySelection(node.id)}
          />
          <Label htmlFor={node.id} className="text-sm font-medium">
            {node.name}
          </Label>
        </div>
        {node.children && <div className="mr-4">{renderCompanyTree(node.children, level + 1)}</div>}
      </div>
    ))
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
              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tag-name">שם התגית</Label>
                <Input
                  id="tag-name"
                  placeholder="שם התגית"
                  value={currentTag.name || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
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
                    <span className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`} />
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
                      "w-full flex-row-reverse justify-between text-right h-9",
                      validationErrors.includes("companies") && "border-red-500 ring-1 ring-red-500",
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
                {validationErrors.includes("companies") && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Securities */}
             <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tag-name">שם התגית</Label>
                <Input
                  id="tag-name"
                  placeholder="שם התגית"
                  value={currentTag.name || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
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
                    <span className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`} />
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
                      "w-full flex-row-reverse justify-between text-right h-9",
                      validationErrors.includes("companies") && "border-red-500 ring-1 ring-red-500",
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
                {validationErrors.includes("companies") && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Securities */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tag-name">שם התגית</Label>
                <Input
                  id="tag-name"
                  placeholder="שם התגית"
                  value={currentTag.name || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
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
                    <span className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`} />
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
                      "w-full flex-row-reverse justify-between text-right h-9",
                      validationErrors.includes("companies") && "border-red-500 ring-1 ring-red-500",
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
                {validationErrors.includes("companies") && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Securities */}
             <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tag-name">שם התגית</Label>
                <Input
                  id="tag-name"
                  placeholder="שם התגית"
                  value={currentTag.name || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
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
                    <span className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`} />
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
                      "w-full flex-row-reverse justify-between text-right h-9",
                      validationErrors.includes("companies") && "border-red-500 ring-1 ring-red-500",
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
                {validationErrors.includes("companies") && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Securities */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tag-name">שם התגית</Label>
                <Input
                  id="tag-name"
                  placeholder="שם התגית"
                  value={currentTag.name || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
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
                    <span className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`} />
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
                      "w-full flex-row-reverse justify-between text-right h-9",
                      validationErrors.includes("companies") && "border-red-500 ring-1 ring-red-500",
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
                {validationErrors.includes("companies") && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Securities */}
             <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tag-name">שם התגית</Label>
                <Input
                  id="tag-name"
                  placeholder="שם התגית"
                  value={currentTag.name || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
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
                    <span className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`} />
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
                      "w-full flex-row-reverse justify-between text-right h-9",
                      validationErrors.includes("companies") && "border-red-500 ring-1 ring-red-500",
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
                {validationErrors.includes("companies") && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Securities */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tag-name">שם התגית</Label>
                <Input
                  id="tag-name"
                  placeholder="שם התגית"
                  value={currentTag.name || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
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
                    <span className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`} />
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
                      "w-full flex-row-reverse justify-between text-right h-9",
                      validationErrors.includes("companies") && "border-red-500 ring-1 ring-red-500",
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
                {validationErrors.includes("companies") && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Securities */}
             <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {/* Tag Name */}
              <div className="space-y-2">
                <Label htmlFor="tag-name">שם התגית</Label>
                <Input
                  id="tag-name"
                  placeholder="שם התגית"
                  value={currentTag.name || ""}
                  onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
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
                    <span className={`w-4 h-4 rounded-full ${colorClasses[currentTag.color]}`} />
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
                      "w-full flex-row-reverse justify-between text-right h-9",
                      validationErrors.includes("companies") && "border-red-500 ring-1 ring-red-500",
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
                {validationErrors.includes("companies") && (
                  <div className="text-red-500 text-xs text-right">שדה חובה</div>
                )}
              </div>

              {/* Securities */}
              <div className="space-y-2">
                <Label htmlFor="securities">ניירות ערך</Label>
                <Select dir="rtl">
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="בחר נייר ערך" />
                  </SelectTrigger>
                  <SelectContent>
                    {securitiesOptions.map((security) => (
                      <SelectItem key={security} value={security} onClick={() => toggleSecurity(security)}>
                        {security}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            </div>

            </div>
            </div>
            </div>
            </div>

            </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={createTag} disabled={!currentTag.name || !currentTag.color}>
                <Plus className="h-4 w-4 ml-2" />
                צור תגית
              </Button>
            </div>
          </CardContent>
        </Card>

        {tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>תגיות שנוצרו</CardTitle>
              <CardDescription>רשימת התגיות שיצרת</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full bg-${tag.color}`} />
                      <div>
                        <h3 className="font-medium">{tag.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {tag.companies.length} חברות, {tag.securities.length} ניירות ערך
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeTag(tag.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
