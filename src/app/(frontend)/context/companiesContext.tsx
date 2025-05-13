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
    if (typeof window !== 'undefined') {
      const savedCompanies = localStorage.getItem('companies')
      const savedLeafCompanies = localStorage.getItem('leafCompanies')

      if (savedCompanies) {
        setCompanies(JSON.parse(savedCompanies))
      }

      if (savedLeafCompanies) {
        setLeafCompanies(JSON.parse(savedLeafCompanies))
      }
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const savedUserCompanies = localStorage.getItem('userCompaniesIds')
    const savedUserLeafCompanies = localStorage.getItem('userLeafCompaniesIds')

    const currentUserCompanies = JSON.stringify(user.companies || [])
    const currentUserLeafCompanies = JSON.stringify(user.leafCompanies || [])

    const companiesChanged = currentUserCompanies !== savedUserCompanies
    const leafCompaniesChanged = currentUserLeafCompanies !== savedUserLeafCompanies

    let shouldFetch = companiesChanged || leafCompaniesChanged
    if (!shouldFetch) {
      if (!shouldFetch) {
        const cachedCompanies = localStorage.getItem('companies')
        const cachedLeafCompanies = localStorage.getItem('leafCompanies')
        shouldFetch = !cachedCompanies || !cachedLeafCompanies
      }
    }

    const fetchSortedData = async () => {
      if (shouldFetch) {
        await fetchData()
        // save new user company IDs in localStorage
        localStorage.setItem('userCompaniesIds', currentUserCompanies)
        localStorage.setItem('userLeafCompaniesIds', currentUserLeafCompanies)
      } else {
        // load from localStorage
        const localCompanies = localStorage.getItem('companies')
        const localLeafCompanies = localStorage.getItem('leafCompanies')

        if (localCompanies && localLeafCompanies) {
          setCompanies(JSON.parse(localCompanies))
          setLeafCompanies(JSON.parse(localLeafCompanies))
        }
      }
    }

    fetchSortedData()
  }, [user])

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/companies-details`)
      if (!response.ok) throw new Error('Failed to fetch compnies data')

      const result = await response.json()
      const allCompanies = result.data

      const companyMap = new Map<string, CompanyType>(
        allCompanies?.map((c: CompanyType) => [c.id, c]),
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

      setCompanies(detailedCompanies as CompanyType[])
      setLeafCompanies(detailedLeafCompanies as LeafCompanyType[])

      localStorage.setItem('companies', JSON.stringify(detailedCompanies))
      localStorage.setItem('leafCompanies', JSON.stringify(detailedLeafCompanies))
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
    throw new Error('useCompaniesContext must be used within a CompaniesProvider')
  }
  return context
}
