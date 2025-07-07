'use client'
import React, { useEffect, useState } from 'react'
import { RelationshipFieldClientComponent } from 'payload'
import { useField, EditIcon, useDocumentDrawer } from '@payloadcms/ui'
import { stringify } from 'qs-esm'
import { Building2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
        className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors duration-150"
      >
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-base font-medium text-foreground">{company.name}</span>
        {/* <EditIcon className="h-4 w-4 text-muted-foreground" /> */}
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
    return <div className="text-center text-base text-muted-foreground">טוען...</div>
  }

  if (error) {
    return <div className="text-center text-base text-destructive">שגיאה: {error}</div>
  }

  if (!companies.length) {
    return <div className="text-center text-base text-muted-foreground">כל החברות הצביעו</div>
  }

  return (
    <div className="w-full max-w-xl p-2" dir="rtl">
      <Card className="border border-border shadow-sm bg-card">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
            <Clock className="h-5 w-5 text-muted-foreground" />
            חברות שטרם הצביעו ({companies.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <div className="space-y-2">
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
