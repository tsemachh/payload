'use client'
import React, { useEffect, useState } from 'react'
import { RelationshipFieldClientComponent } from 'payload'
import { useField, EditIcon, useDocumentDrawer } from '@payloadcms/ui'
import { stringify } from 'qs-esm'

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
    <li key={company.id}>
      <DocumentDrawerToggler
        drawerSlug={`${drawerSlug}-${company.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
        }}
      >
        <span>{company.name}</span>
        <EditIcon />
      </DocumentDrawerToggler>
      <DocumentDrawer drawerSlug={`${drawerSlug}-${company.id}`} />
    </li>
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
    return <div>טוען...</div>
  }

  if (error) {
    return <div>שגיאה: {error}</div>
  }

  if (!companies.length) {
    return <div>כל החברות הצביעו</div>
  }

  return (
    <div className="simple-list">
      <h4>החברות שטרם הצביעו</h4>
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {companies.map((company) => (
          <CompanyItem key={company.id} company={company} collectionSlug={collectionSlug} />
        ))}
      </ul>
    </div>
  )
}

export default CompaniesRelationshipField
