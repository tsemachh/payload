'use client'
import React, { useEffect, useState } from 'react'
import { RelationshipFieldClientComponent } from 'payload'
import { useField, EditIcon, useDocumentDrawer } from '@payloadcms/ui'
import { stringify } from 'qs-esm'
import { Building2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type CompanyWithName = {
  id: string
  name: string
}

// רכיב עזר לטיפול בפריט בודד
const CompanyItem: React.FC<{ company: CompanyWithName; collectionSlug: string }> = ({
  company,
  collectionSlug,
}) => {
  const [DocumentDrawer, DocumentDrawerToggler, { drawerSlug }] = useDocumentDrawer({
    collectionSlug,
    id: company.id,
    overrideEntityVisibility: true,
  })

  return (
    <>
      <DocumentDrawerToggler
        drawerSlug={`${drawerSlug}-${company.id}`}
        className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 transition-colors duration-150"
      >
        <div className="p-1 bg-slate-100 rounded">
          <Building2 className="h-3 w-3 text-slate-600" />
        </div>
        <span className="text-sm text-slate-700">{company.name}</span>
        <EditIcon className="h-4 w-4 text-slate-600" />
      </DocumentDrawerToggler>
      <DocumentDrawer drawerSlug={`${drawerSlug}-${company.id}`} />
    </>
  )
}

const CompaniesRelationshipField: RelationshipFieldClientComponent = (props) => {
  const { relationTo } = props.field
  const { path } = props
  const { value } = useField<string[]>({ path })
  const [companies, setCompanies] = useState<CompanyWithName[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const collectionSlug = Array.isArray(relationTo) ? relationTo[0] : relationTo

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!value || !value.length) {
        setCompanies([])
        setLoading(false)
        return
      }

      try {
        const query = {
          where: {
            id: {
              in: value,
            },
          },
          select: {
            id: true,
            name: true,
          },
          depth: 0,
          limit: 0,
        }

        const stringifiedQuery = stringify(query, { addQueryPrefix: true })
        const response = await fetch(`/api/${collectionSlug}${stringifiedQuery}`)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        setCompanies(data.docs || [])
      } catch (err) {
        console.error('Error fetching companies:', err)
        setError('Failed to fetch companies')
      } finally {
        setLoading(false)
      }
    }

    fetchCompanies()
  }, [value, collectionSlug])

  if (loading) {
    return <div className="text-center text-sm text-slate-600">טוען...</div>
  }

  if (error) {
    return <div className="text-center text-sm text-red-600">שגיאה: {error}</div>
  }

  if (!companies.length) {
    return
  }

  return (
    <div className="w-full max-w-xl mx-auto p-2" dir="rtl">
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <div className="p-1 bg-orange-50 rounded">
              <Clock className="h-3.5 w-3.5 text-orange-600" />
            </div>
            חברות שטרם הצביעו
            <Badge
              variant="secondary"
              className="mr-auto text-xs px-2 py-0.5 bg-slate-100 text-slate-600"
            >
              {companies.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3 pb-3">
          <div className="space-y-1">
            {companies.map((company) => (
              <CompanyItem key={company.id} company={company} collectionSlug={collectionSlug} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CompaniesRelationshipField
