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
  const { companies: companiesMap, funds } = useCompaniesContext()
  const [selectedCompanies, setSelectedCompanies] = useState<string>(
    meetingCompanies.length > 1 && isGeneralVoteOption
      ? 'all'
      : meetingCompanies.length === 1
        ? companiesIDs[0]
        : 'none',
  )
  const [fundPassiveMap, setFundPassiveMap] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    setFundPassiveMap(new Map(funds?.map((fund) => [fund.id, fund.passiveFund]) || []))
  }, [funds])

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

  const isCompanyPassive = (company?: CompanyTableDate) => {
    return (
      company?.funds?.every((fund) =>
        fundPassiveMap.has(fund.id) ? fundPassiveMap.get(fund.id) : false,
      ) ?? false
    )
  }

  const areAllCompaniesPassive = () => {
    return meetingCompanies?.length > 0
      ? meetingCompanies.every((company) =>
          company.funds.every((fund) =>
            fundPassiveMap.has(fund.id) ? fundPassiveMap.get(fund.id) : false,
          ),
        )
      : false
  }

  const getSummaryText = () => {
    if (selectedCompanies === 'none') {
      return 'אין חברות זמינות להצבעה'
    } else if (selectedCompanies === 'all') {
      return (
        <>
          הצבעה עבור כל החברות
          {areAllCompaniesPassive() && (
            <span className="inline-block bg-primary-light text-primary-dark text-xs px-2 py-1 rounded-full border border-primary-border mx-4 shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
              קרנות מחקות בלבד
            </span>
          )}
        </>
      )
    } else {
      const companyName = companiesMap.find((c) => c.id === selectedCompanies)?.name || ''
      const isPassive = isCompanyPassive(meetingCompanies.find((c) => c.id === selectedCompanies))

      return (
        <>
          הצבעה עבור חברת: <i>{`${companyName} `}</i>
          {isPassive && (
            <span className="inline-block bg-primary-light text-primary-dark text-xs px-2 py-1 rounded-full border border-primary-border mx-4 shadow-[0_3px_9px_rgba(0,0,0,0.15)]">
              קרנות מחקות בלבד
            </span>
          )}
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
                    {isGeneralVoteOption && votedCompanies.size === meetingCompanies.length && (
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
                  {meetingData.percentageHolding && (
                    <p>{Math.round(meetingData.percentageHolding * 100) / 100}%</p>
                  )}
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
                    {isCompanyPassive(meetingCompanies.find((c) => c.id === company.id)) && (
                      <span className="font-bold">&nbsp;קרנות מחקות בלבד&nbsp;</span>
                    )}
                  </span>
                </label>
              </TooltipTrigger>
              <TooltipContent>
                {company.originalStockIds?.length ? (
                  <div className="flex flex-col">
                    <div className="flex justify-between gap-4 font-bold">
                      <div>מס׳ נייר</div>
                      <div>ע׳ נקוב</div>
                    </div>
                    {company.originalStockIds.map((stock: any, index: number) => (
                      <div className="flex justify-between gap-4" key={`${index}-${stock.stockId}`}>
                        <div>{stock.stockId}</div>
                        <div>{stock.quantity.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <></>
                )}
                <div className="text-sm font-bold">
                  <p>
                    {`${company.originalStockIds?.length ? 'סה״כ' : 'ע׳ נקוב'} `}
                    {company.nominalValue.toLocaleString()}
                  </p>
                  <p>{Math.round(company.percentageHolding * 100) / 100}%</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
