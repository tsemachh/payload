'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/providers/auth-provider'
import { Company, CompanySelector } from './CompanySelector'
import { DateSelector } from './DateSelector'
import { DataTableStatic as DataTable  } from '../../components/data-table-client'
import { columns } from '../columns'
import { Holding } from '../types'
import { ExportButton } from '../../components/export-button'

export function HoldingsView() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Extract companies from user
  useEffect(() => {
    if (user?.companies) {
      const userCompanies = user.companies.map(company => {
        // Handle company as either a string ID or an object with an ID
        const companyObj = typeof company.companyId === 'string' 
          ? { id: company.companyId, name: company.companyId } 
          : { id: company.companyId?.id || '', name: company.companyId?.name || '' }
        
        return companyObj
      }).filter(company => company.id !== '')
      
      setCompanies(userCompanies)
    }
  }, [user])

  const fetchHoldings = async () => {
    if (!date) {
      toast({
        title: 'שגיאה',
        description: 'נא לבחור תאריך',
        variant: 'destructive',
      })
      return
    }
    
    if (selectedCompanies.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'נא לבחור לפחות חברה אחת',
        variant: 'destructive',
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      const formattedDate = format(date, 'yyyy-MM-dd')
      const companiesParam = selectedCompanies.join(',')
      const response = await fetch(`/api/holdings?date=${formattedDate}&companies=${companiesParam}`)
      const data = await response.json()
      
      if (response.ok) {
        setHoldings(data.docs.map((holding: any) => ({
          id: holding.id,
          company: holding.stock?.longName || 'N/A',
          stockNumber: holding.stock?.stockId || 'N/A',
          quantity: holding.quantity,
          lastUpdated: holding.updatedAt,
        })))
      } else {
        toast({
          title: 'שגיאה בטעינת נתונים',
          description: data.error || 'אירעה שגיאה בטעינת הנתונים',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching holdings:', error)
      toast({
        title: 'שגיאה בטעינת נתונים',
        description: 'אירעה שגיאה בטעינת הנתונים',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-6 md:flex-row md:space-y-0 md:space-x-6 md:space-x-reverse">
        <div className="w-full md:w-3/10">
          <label className="text-sm font-medium mb-2 block">חברות</label>
          <CompanySelector 
            companies={companies}
            selectedCompanies={selectedCompanies}
            onSelectionChange={setSelectedCompanies}
            className="w-full"
          />
        </div>
        
        <div className="w-full md:w-1/10">
          <label className="text-sm font-medium mb-2 block">תאריך ערך</label>
          <DateSelector 
            date={date}
            onDateChange={setDate}
            className="w-full"
          />
        </div>
        
        <div className="w-full md:flex-1 flex items-end">
          <Button 
            onClick={fetchHoldings}
            disabled={!date || selectedCompanies.length === 0 || isLoading}
            className="mb-[22px]"
          >
            {isLoading ? 'טוען...' : 'טען אחזקות'}
          </Button>
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-8">
        <h2 className="text-xl font-semibold">טבלת אחזקות</h2>
        {holdings.length > 0 && (
          <ExportButton 
            data={holdings} 
            filename={`holdings-${date ? format(date, 'yyyy-MM-dd') : 'export'}`} 
          />
        )}
      </div>
      
      {holdings.length > 0 ? (
        <DataTable 
          columns={columns} 
          data={holdings} 
          idField="id"
          defaultSortField="lastUpdated"
          defaultSortDirection="desc"
          tableId="holdings-view-table"
          pastDateFilterOptions={[
            { value: 'allPast', label: 'כל האחזקות הקודמות' },
          ]}
          futureDateFilterOptions={[
            { value: 'allFuture', label: 'כל האחזקות העתידיות' },
          ]}
        />
      ) : (
        <div className="text-center py-10 text-gray-500 border rounded-md">
          {isLoading ? 'טוען נתונים...' : 'לא נמצאו נתונים עבור הבחירה הנוכחית'}
        </div>
      )}
    </div>
  )
}