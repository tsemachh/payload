'use client'
import React, { useEffect } from 'react'
import { useField, useFormInitializing, TextField } from '@payloadcms/ui'
import { TextFieldClientProps } from 'payload'

export interface LinkFromRelationFieldProps {
  relationField: string
  baseUrl: string
  suffix: string
}

const LinkFromRelationField: React.FC<LinkFromRelationFieldProps & TextFieldClientProps> = (
  props,
) => {
  console.log('==============================================')

  const { relationField, baseUrl, suffix, path } = props
  const formInitializing = useFormInitializing()
  console.log('formInitializing', formInitializing)
  console.log('relationField', relationField)
  console.log('props', props)

  // Field for storing the generated link
  const { value, setValue } = useField<string>({
    path: `${path}`,
  })

  // Field for accessing the related stock ID
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
        console.log('generatedLink', generatedLink)
      }
    }
  }, [])

  return <TextField {...props} />
}

export default LinkFromRelationField
