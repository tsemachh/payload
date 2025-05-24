'use client'
import { RelationshipField, useField } from '@payloadcms/ui'
import { RelationshipFieldClientProps } from 'payload'
import { useEffect } from 'react'
const CompaniesRelationField: React.FC<RelationshipFieldClientProps> = (props) => {
  const { value:file } = useField<string>({
    path: `file`,
  })

  useEffect(() => {
    console.error("Hurray:",file)
  }, [file])
  return (
      <RelationshipField {...props} />
  )
}

export default CompaniesRelationField
