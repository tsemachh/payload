'use client'

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { CompanyType, FundType } from '../types/companies'
import { Company } from '@/payload-types'

type CompaniesContextType = {
  companies: CompanyType[]
  funds: FundType[]
}

const CompaniesContext = createContext<CompaniesContextType | undefined>(undefined)

export const CompaniesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<CompanyType[]>([])
  const [funds, setFunds] = useState<FundType[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCompanies = localStorage.getItem('companies')
      const savedFunds = localStorage.getItem('funds')

      if (savedCompanies) {
        setCompanies(JSON.parse(savedCompanies))
      }

      if (savedFunds) {
        setFunds(JSON.parse(savedFunds))
      }
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const savedUserCompanies = localStorage.getItem('userCompaniesIds')
    const savedUserFunds = localStorage.getItem('userFunds')

    const currentUserCompanies = JSON.stringify(user.companies || [])
    const currentUserFunds = JSON.stringify(user.funds || [])

    const companiesChanged = currentUserCompanies !== savedUserCompanies
    const fundsChanged = currentUserFunds !== savedUserFunds

    let shouldFetch = companiesChanged || fundsChanged
    if (!shouldFetch) {
      if (!shouldFetch) {
        const cachedCompanies = localStorage.getItem('companies')
        const cachedFunds = localStorage.getItem('funds')
        shouldFetch = !cachedCompanies || !cachedFunds
      }
    }

    const fetchSortedData = async () => {
      if (shouldFetch) {
        await fetchData()
        // save new user company IDs in localStorage
        localStorage.setItem('userCompaniesIds', currentUserCompanies)
        localStorage.setItem('userFunds', currentUserFunds)
      } else {
        // load from localStorage
        const localCompanies = localStorage.getItem('companies')
        const localFunds = localStorage.getItem('funds')

        if (localCompanies && localFunds) {
          setCompanies(JSON.parse(localCompanies))
          setFunds(JSON.parse(localFunds))
        }
      }
    }

    fetchSortedData()
  }, [user])

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/companies/details`)
      if (!response.ok) throw new Error('Failed to fetch compnies data')

      const result = await response.json()
      const allCompanies = result.data

      const companyMap = new Map<string, Company>(allCompanies?.map((c: Company) => [c.id, c]))
      // === Create detailed companies array ===
      const detailedCompanies = (user?.companies || [])
        .map((company) => {
          const id = typeof company === 'string' ? company : company.companyId
          if (typeof id !== 'string') return null
          const fullCompany = companyMap.get(id)
          if (!fullCompany || !(fullCompany as Company)) return null
          return {
            id: fullCompany.id,
            name: fullCompany.name,
            parentCompany: fullCompany.parentCompany?.docs?.[0] ?? null,
            subCompanies: fullCompany.subCompanies,
          }
        })
        .filter(Boolean)

      // === Create detailed funds array ===
      const detailedFunds = (user?.funds || [])
        .map((company: string | { id: string }) => {
          const id = typeof company === 'string' ? company : company.id
          const fullCompany = companyMap.get(id)
          if (!fullCompany) return null
          return {
            id: fullCompany.id,
            name: fullCompany.name,
            parentCompany: fullCompany.parentCompany?.docs?.[0] ?? null,
          }
        })
        .filter(Boolean)

      setCompanies(detailedCompanies as CompanyType[])
      setFunds(detailedFunds as FundType[])

      localStorage.setItem('companies', JSON.stringify(detailedCompanies))
      localStorage.setItem('funds', JSON.stringify(detailedFunds))
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  return (
    <CompaniesContext.Provider value={{ companies, funds }}>{children}</CompaniesContext.Provider>
  )
}

export const useCompaniesContext = () => {
  const context = useContext(CompaniesContext)
  if (!context) {
    throw new Error('useCompaniesContext must be used within a CompaniesProvider')
  }
  return context
}
