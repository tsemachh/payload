'use client'

import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CompanyTableDate, MeetingTableDataType } from '../../types/meetings'
import { useCompaniesContext } from '../../context/companiesContext'
import { CheckIcon } from 'lucide-react'

interface VoteCompanySelectorProps {
  meetingData: MeetingTableDataType
  meetingCompanies: CompanyTableDate[]
  companiesIDs: string[]
  setCompaniesIDsAction: (selectedCompanyIds: string[]) => void
  isGeneralVoteOption: boolean
  votedCompanies: Set<string>
}

export default function VoteCompanySelector({
  meetingData,
  meetingCompanies,
  companiesIDs,
  setCompaniesIDsAction,
  isGeneralVoteOption,
  votedCompanies,
}: VoteCompanySelectorProps) {
  const { companies: companiesMap } = useCompaniesContext()
  const [selectedCompanies, setSelectedCompanies] = useState<string>(
    meetingCompanies.length > 1 && isGeneralVoteOption
      ? 'all'
      : meetingCompanies.length === 1
        ? companiesIDs[0]
        : 'none',
  )

  useEffect(() => {
    if (companiesIDs.length > 1 && isGeneralVoteOption) {
      setSelectedCompanies('all')
    } else if (companiesIDs.length === 1) {
      setSelectedCompanies(companiesIDs[0])
    } else {
      setSelectedCompanies('none')
    }
  }, [companiesIDs])

  const handleCompanyChange = (companyId: string) => {
    if (companyId === 'all' && isGeneralVoteOption) {
      setCompaniesIDsAction(meetingCompanies.map((comp: CompanyTableDate) => comp.id) || [])
    } else {
      setCompaniesIDsAction([companyId])
    }
  }

  const getSummaryText = () => {
    if (selectedCompanies === 'none') {
      return 'אין חברות זמינות להצבעה'
    } else if (selectedCompanies === 'all') {
      return 'הצבעה עבור כל החברות'
    } else {
      return (
        <>
          הצבעה עבור חברת: <i>{companiesMap.find((c) => c.id === selectedCompanies)?.name || ''}</i>
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
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-all ${
                    selectedCompanies === 'all'
                      ? 'bg-primary text-primary-foreground shadow-sm cursor-pointer'
                      : isGeneralVoteOption
                        ? 'bg-muted hover:bg-muted/80 text-foreground cursor-pointer'
                        : 'bg-muted/50 text-foreground/50 cursor-default'
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    value="all"
                    disabled={!isGeneralVoteOption}
                    checked={selectedCompanies === 'all'}
                    onChange={() => handleCompanyChange('all')}
                  />
                  <span className="flex items-center gap-1">
                    {isGeneralVoteOption && (
                      <CheckIcon
                        className={`w-4 h-4 ${selectedCompanies === 'all' && 'text-primary-foreground '}`}
                      />
                    )}
                    כל החברות
                  </span>
                </label>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p>ע׳ נקוב {meetingData.nominalValue.toLocaleString()}</p>
                  <p>{meetingData.percentageHolding}%</p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {meetingCompanies.map((company) => (
            <Tooltip key={company.id}>
              <TooltipTrigger asChild>
                <label
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-all ${
                    selectedCompanies === company.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    value={company.id}
                    checked={selectedCompanies === company.id}
                    onChange={() => handleCompanyChange(company.id)}
                  />
                  <span className="flex items-center gap-1">
                    {!isGeneralVoteOption && votedCompanies.has(company.id) && (
                      <CheckIcon
                        className={`w-4 h-4 ${selectedCompanies === company.id && 'text-primary-foreground '}`}
                      />
                    )}
                    {companiesMap.find((c) => c.id === company?.id)?.name || '-'}
                  </span>
                </label>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p>ע׳ נקוב {company.nominalValue.toLocaleString()}</p>
                  <p>{Math.round(company.percentageHolding)}%</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
