import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CompanyOption {
  id: string
  label: string
}

interface SelectParentCompanyTreeProps {
  companies: CompanyOption[]
  onSelect: (companyId: string) => void
}

export const SelectParentCompanyTree: React.FC<SelectParentCompanyTreeProps> = ({
  companies,
  onSelect,
}) => {
  if (!companies || companies.length === 0) {
    return <div className="text-red-600">לא נמצאו חברות.</div>
  }

  return (
    <Select dir={'rtl'} onValueChange={onSelect}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="בחר חברה" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
