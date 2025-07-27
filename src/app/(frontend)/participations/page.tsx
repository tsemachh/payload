'use client'

import { useState, useMemo, useEffect } from 'react'
import { useCompaniesContext } from '../context/companiesContext'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DateRangeSelector } from '../components/ui/date-range-selector'
import { CompanyTreeSelector } from '../holdings/components/CompanySelector' // Using the user's specified component name
import { useAuth } from '@payloadcms/ui'

export interface Company {
  id: string
  name: string
}

export interface Fund {
  id: string
  name: string
  parentCompany: string
}

export interface CompanyWithFunds extends Company {
  funds: Fund[]
}

type DateRangeType = 'two-years' | 'one-year' | 'month' | 'week' | 'custom'

export default function Participations() {
  const { companies, funds } = useCompaniesContext()
  const { user } = useAuth()

  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [rangeType, setRangeType] = useState<DateRangeType | undefined>(undefined)

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

  // Initialize selectedFundIds to all funds by default when companiesWithFunds is available
  useEffect(() => {
    if (companiesWithFunds.length > 0) {
      const allFundIds = companiesWithFunds.flatMap((company) =>
        company.funds.map((fund) => fund.id),
      )
      setSelectedFundIds(allFundIds)
    }
  }, [companiesWithFunds])

  const handleFundsSelectionChange = (selected: string[]) => {
    setSelectedFundIds(selected)
  }

  const handleRangeChange = (
    newStartDate: Date | undefined,
    newEndDate: Date | undefined,
    type: DateRangeType,
  ) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)
    setRangeType(type)
  }

  const handleExport = () => {
    console.log('Exporting data with:', {
      startDate,
      endDate,
      rangeType,
      selectedFunds: selectedFundIds,
    })
    // Add your export logic here
  }

  // Function to get summary for the Select trigger
  const getCompanySelectSummary = () => {
    if (selectedFundIds.length === 0) {
      return 'בחר חברות/חשבונות'
    }

    const totalFundIds = companiesWithFunds.flatMap((company) =>
      company.funds.map((fund) => fund.id),
    )

    const allSelected =
      selectedFundIds.length === totalFundIds.length &&
      selectedFundIds.every((id) => totalFundIds.includes(id))

    if (allSelected) {
      return 'נבחרו הכל'
    }

    return `נבחרו ${selectedFundIds.length} חשבונות`
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row justify-center gap-6 mx-auto">
        {/* Date Range Selector */}
        <div className="w-full md:w-[280px] min-h-[200px]">
          <DateRangeSelector onRangeChange={handleRangeChange} />
        </div>

        {/* Company/Fund Selector - Now wrapped in shadcn Select */}
        <div className="w-full md:w-[280px]">
          <label className="text-base font-semibold mb-2 block text-right">חברות</label>
          <Select>
            <SelectTrigger className="w-[280px] flex-row-reverse justify-between text-right">
              <SelectValue placeholder={getCompanySelectSummary()} />
            </SelectTrigger>
            <SelectContent align="end" dir="rtl" className="p-0">
              <CompanyTreeSelector
                selectedCompanies={selectedFundIds}
                onSelectionChangeAction={handleFundsSelectionChange}
                className="w-full"
                showSearch={false}
              />
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-center mt-24">
        <Button onClick={handleExport} variant="defaultHover">
          ייצוא
        </Button>
      </div>
    </div>
  )
}

