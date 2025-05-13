'use client'

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { CompanyType, LeafCompanyType } from '../types/companies'

type CompaniesContextType = {
  companies: CompanyType[]
  leafCompanies: LeafCompanyType[]
}

const CompaniesContext = createContext<CompaniesContextType | undefined>(undefined)

export const CompaniesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<CompanyType[]>([])
  const [leafCompanies, setLeafCompanies] = useState<LeafCompanyType[]>([])

  useEffect(() => {
    if (user?.companies || user?.leafCompanies) {
      const fetchSortedData = async () => {
        await fetchData()
      }
      fetchSortedData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/companies-details`)
      if (!response.ok) {
        throw new Error('Failed to fetch compnies data')
      }
      const result = await response.json()
      const allCompanies = result.data

      const companyMap = new Map<string, CompanyType>(
        allCompanies.map((c: CompanyType) => [c.id, c]),
      )
      // === Create detailed companies array ===
      const detailedCompanies = (user?.companies || [])
        .map((company) => {
          const id = typeof company === 'string' ? company : company.companyId
          if (typeof id !== 'string') return null
          const fullCompany = companyMap.get(id)
          if (!fullCompany || !(fullCompany as CompanyType)) return null
          return {
            id: fullCompany.id,
            name: fullCompany.name,
            parentCompany: fullCompany.parentCompany,
            subCompanies: fullCompany.subCompanies,
          }
        })
        .filter(Boolean)

      // === Create detailed leafCompanies array ===
      const detailedLeafCompanies = (user?.leafCompanies || [])
        .map((company: string | { id: string }) => {
          const id = typeof company === 'string' ? company : company.id
          const fullCompany = companyMap.get(id)
          if (!fullCompany) return null
          return {
            id: fullCompany.id,
            name: fullCompany.name,
            parentCompany: fullCompany.parentCompany,
          }
        })
        .filter(Boolean)
      console.log('detailedCompanies', detailedCompanies)

      setCompanies(detailedCompanies as CompanyType[])
      setLeafCompanies(detailedLeafCompanies as LeafCompanyType[])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  return (
    <CompaniesContext.Provider value={{ companies, leafCompanies }}>
      {children}
    </CompaniesContext.Provider>
  )
}

export const useCompaniesContext = () => {
  const context = useContext(CompaniesContext)
  if (!context) {
    throw new Error('useGlobalContext must be used within a GlobalProvider')
  }
  return context
}
