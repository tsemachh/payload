'use client'
import React, { useEffect } from 'react'
import { useField, useFormInitializing } from '@payloadcms/ui'
import { TextFieldClientProps } from 'payload'

export interface LinkFromRelationFieldProps {
  relationField: string
  baseUrl: string
  suffix: string
  name: string
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
    // if (!formInitializing) {
    //   return
    // }
    if (relationValue) {
      const generatedLink = `${baseUrl}${relationValue}${suffix}`
      if (generatedLink !== value) {
        setValue(generatedLink)
        console.log('generatedLink', generatedLink)
      }
    }
  }, [formInitializing, relationValue, value, setValue, baseUrl, suffix])

  return (
    <a style={{ paddingTop: '20px' }} href={value} target="_blank" rel="noopener noreferrer">
      {props.name}
    </a>
  )
}

export default LinkFromRelationField
