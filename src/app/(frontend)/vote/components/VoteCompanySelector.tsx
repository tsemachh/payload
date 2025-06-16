'use client'

import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CompanyTableDate, MeetingTableDataType } from '../../types/meetings'
import { useCompaniesContext } from '../../context/companiesContext'

interface VoteCompanySelectorProps {
  meetingData: MeetingTableDataType
  meetingCompanies: CompanyTableDate[]
  onSelectionChangeAction: (selectedCompanyIndex: number) => void
}

export default function VoteCompanySelector({
  meetingData,
  meetingCompanies,
  onSelectionChangeAction,
}: VoteCompanySelectorProps) {
  const { companies: companiesMap } = useCompaniesContext()
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState<number>(
    meetingCompanies.length > 1 ? -1 : meetingCompanies.length === 1 ? 0 : -2, //  -1 means "all companies", -2 means "no companies"
  )

  useEffect(() => {
    if (meetingCompanies.length === 1) {
      setSelectedCompanyIndex(0)
      onSelectionChangeAction(0)
    } else if (meetingCompanies.length > 1) {
      setSelectedCompanyIndex(-1)
      onSelectionChangeAction(-1)
    } else {
      setSelectedCompanyIndex(-2)
    }
  }, [meetingCompanies, onSelectionChangeAction])

  const handleCompanyChange = (index: number) => {
    setSelectedCompanyIndex(index)
    onSelectionChangeAction(index)
  }

  const getSummaryText = () => {
    if (selectedCompanyIndex === -2) {
      return 'אין חברות זמינות להצבעה'
    } else if (selectedCompanyIndex === -1) {
      return 'הצבעה עבור כל החברות'
    } else {
      const selectedCompany = meetingCompanies[selectedCompanyIndex]
      return (
        <>
          הצבעה עבור חברת:{' '}
          <i>{companiesMap.find((c) => c.id === selectedCompany?.id)?.name || ''}</i>
        </>
      )
    }
  }

  if (meetingCompanies.length === 0) {
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
          {meetingCompanies.length > 1 && (
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

          {meetingCompanies.map((company, index) => (
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
                  <span>{companiesMap.find((c) => c.id === company?.id)?.name || '-'}</span>
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
