'use client'

import { useState } from 'react'
import { VoteCompanyType } from '../../types/vote'

interface VoteCompanySelectorProps {
  companies: VoteCompanyType[]
  onSelectionChange: (selectedCompanyIndex: number) => void
}

export default function VoteCompanySelector({
  companies,
  onSelectionChange,
}: VoteCompanySelectorProps) {
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState<number>(
    companies.length > 1 ? -1 : 0,
  ) // -1 means "all companies"

  const handleCompanyChange = (index: number) => {
    setSelectedCompanyIndex(index)
    onSelectionChange(index)
  }

  const getSummaryText = () => {
    if (selectedCompanyIndex === -1) {
      return 'הצבעה עבור כל החברות'
    } else {
      const selectedCompany = companies[selectedCompanyIndex]
      return (
        <>
          הצבעה עבור חברת: <i>{selectedCompany.name}</i>
        </>
      )
    }
  }

  return (
    <div className="mb-4">
      <div className="mb-4 font-medium text-base text-primary">{getSummaryText()}</div>
      <div className="flex flex-wrap gap-2">
        {companies.length > 1 && (
          <>
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
          </>
        )}

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
            <span>{company.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
