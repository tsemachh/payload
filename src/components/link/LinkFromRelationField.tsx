'use client'

import React, { useEffect } from 'react'
import { TextField, useField, useFieldProps, useFormInitializing } from '@payloadcms/ui'
import { TextFieldClientProps } from 'payload'

export interface LinkFromRelationFieldProps {
  relationField: string
  baseUrl: string
  suffix: string
}

const LinkFromRelationField: React.FC<LinkFromRelationFieldProps & TextFieldClientProps> = (
  props,
) => {
  const { relationField, baseUrl, suffix } = props
  const formInitializing = useFormInitializing()

  const { path } = useFieldProps()
  const { value, setValue } = useField<string>({
    path: `${path}`,
  })

  const { value: relationValue } = useField<string>({
    path: `${relationField}`,
  })

  useEffect(() => {
    if (formInitializing) {
      return
    }

    if (relationValue) {
      const generatedLink = `${baseUrl}${relationValue}${suffix}`
      if (generatedLink !== value) {
        setValue(generatedLink)
      }
    }
  }, [relationValue])

  return <TextField {...props} />
}

export default LinkFromRelationField
