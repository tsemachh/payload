'use client'

import { useState } from 'react'
import { CompanyTableDate } from '../../types/meetings'
import { Company } from '@/payload-types'

interface VoteCompanySelectorProps {
  companies: CompanyTableDate[]
  parentCompany: Company[]
  onSelectionChange: (selectedCompanyIndex: number) => void
}

export default function VoteCompanySelector({
  companies,
  parentCompany,
  onSelectionChange,
}: VoteCompanySelectorProps) {
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState<number>(-1)
  const handleCompanyChange = (index: number) => {
    setSelectedCompanyIndex(index)
    onSelectionChange(index)
  }

  const getSummaryText = () => {
    if (selectedCompanyIndex === -1) {
      return 'הצבעה עבור כל החברות'
    } else {
      const selectedCompany = companies[selectedCompanyIndex]
      return `הצבעה עבור חברה ${selectedCompany.holdingsCompanyName}`
    }
  }

  return (
    <div className="mb-4">
      <div className="mb-4 font-medium text-base text-primary">{getSummaryText()}</div>
      <div className="flex flex-wrap gap-2">
        <label
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-all ${
            selectedCompanyIndex === -1
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted hover:bg-muted/80 text-foreground'
          }`}
        >
          <input
            type="radio"
            className="sr-only"
            name="company"
            value="-1"
            checked={selectedCompanyIndex === -1}
            onChange={() => handleCompanyChange(-1)}
          />
          <span>כל החברות</span>
        </label>

        {companies.map((company, index) => (
          <label
            key={index}
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-all ${
              selectedCompanyIndex === index
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name="company"
              value={index}
              checked={selectedCompanyIndex === index}
              onChange={() => handleCompanyChange(index)}
            />
            <span>{company.holdingsCompanyName}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
