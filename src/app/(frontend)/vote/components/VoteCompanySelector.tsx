'use client'

import { useState, useEffect } from 'react'
import { VoteCompanyType } from '../../types/vote'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MeetingTableDataType } from '../../types/meetings'

interface VoteCompanySelectorProps {
  meetingData: MeetingTableDataType
  companies: VoteCompanyType[]
  onSelectionChange: (selectedCompanyIndex: number) => void
}

export default function VoteCompanySelector({
  meetingData,
  companies,
  onSelectionChange,
}: VoteCompanySelectorProps) {
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState<number>(
    companies.length > 1 ? -1 : companies.length === 1 ? 0 : -2, //  -1 means "all companies", -2 means "no companies"
  )

  useEffect(() => {
    if (companies.length === 1) {
      setSelectedCompanyIndex(0)
      onSelectionChange(0)
    } else if (companies.length > 1) {
      setSelectedCompanyIndex(-1)
      onSelectionChange(-1)
    } else {
      setSelectedCompanyIndex(-2)
    }
  }, [companies, onSelectionChange])

  const handleCompanyChange = (index: number) => {
    setSelectedCompanyIndex(index)
    onSelectionChange(index)
  }

  const getSummaryText = () => {
    if (selectedCompanyIndex === -2) {
      return 'אין חברות זמינות להצבעה'
    } else if (selectedCompanyIndex === -1) {
      return 'הצבעה עבור כל החברות'
    } else {
      const selectedCompany = companies[selectedCompanyIndex]
      return (
        <>
          הצבעה עבור חברת: <i>{selectedCompany?.name}</i>
        </>
      )
    }
  }

  if (companies.length === 0) {
    return (
      <div className="mb-4">
        <div className="font-medium text-base text-destructive">אין חברות זמינות להצבעה</div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="mb-4">
        <div className="mb-4 font-medium text-base text-primary">{getSummaryText()}</div>
        <div className="flex flex-wrap gap-2">
          {companies.length > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p>ע׳ נקוב {meetingData.nominalValue.toLocaleString()}</p>
                  <p>{meetingData.percentageHolding}%</p>
                  <p>{meetingData.holdingValueInMillions} מליון ש״ח</p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {companies.map((company, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <label
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
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p>ע׳ נקוב {company.nominalValue.toLocaleString()}</p>
                  <p>{company.percentageHolding}%</p>
                  <p>{company.holdingValueInMillions} מליון ש״ח</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
