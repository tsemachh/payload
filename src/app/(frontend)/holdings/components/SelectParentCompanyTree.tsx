import React from 'react'

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
    <div className="space-y-2">
      <select
        id="company-select"
        onChange={(e) => onSelect(e.target.value)}
        className="border p-2 rounded w-full"
        defaultValue=""
      >
        <option value="" disabled>
          בחר חברה
        </option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.label}
          </option>
        ))}
      </select>
    </div>
  )
}
