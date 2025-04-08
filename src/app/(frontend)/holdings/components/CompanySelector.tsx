'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

export interface Company {
  id: string
  name: string
}

interface CompanySelectorProps {
  companies: Company[]
  selectedCompanies: string[]
  onSelectionChange: (selected: string[]) => void
  className?: string
}

export function CompanySelector({
  companies,
  selectedCompanies,
  onSelectionChange,
  className
}: CompanySelectorProps) {
  const [open, setOpen] = useState(false)
  const [isClient, setIsClient] = useState(false)

  // Set isClient to true after component mounts
  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleSelect = (companyId: string) => {
    if (selectedCompanies.includes(companyId)) {
      onSelectionChange(selectedCompanies.filter(id => id !== companyId))
    } else {
      onSelectionChange([...selectedCompanies, companyId])
    }
  }

  const handleRemoveCompany = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectionChange(selectedCompanies.filter(id => id !== companyId))
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-[200px] h-10 justify-between"
          >
            <span className="truncate">
              {!isClient || selectedCompanies.length === 0
                ? 'בחר חברות'
                : `${selectedCompanies.length} חברות נבחרו`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="חפש חברה..." />
            <CommandEmpty>לא נמצאו חברות.</CommandEmpty>
            <CommandGroup>
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={company.id}
                  onSelect={() => handleSelect(company.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCompanies.includes(company.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {company.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {isClient && selectedCompanies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedCompanies.map((id) => {
            const company = companies.find(c => c.id === id)
            return company ? (
              <Badge key={id} variant="secondary" className="px-3 py-1">
                {company.name}
                <button
                  className="ml-2 text-muted-foreground hover:text-foreground"
                  onClick={(e) => handleRemoveCompany(id, e)}
                >
                  ×
                </button>
              </Badge>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}
