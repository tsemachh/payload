'use client'

import React, { useEffect } from 'react'
import { useField, useFormInitializing } from '@payloadcms/ui'

export interface AProps {
  label: string
  path: string
}

const A: React.FC<AProps> = (props) => {
  const { label, path } = props
  const formInitializing = useFormInitializing()

  const { value, setValue } = useField<string>({ path })

  // Log to debug and verify the component is running
  console.log('=======================================')
  console.log('Component A is running!')
  console.log('Props:', props)
  console.log('Form Initializing:', formInitializing)
  console.log('Current Value:', value)

  // Set an initial value if none exists
  useEffect(() => {
    if (formInitializing) {
      return
    }
    if (!value) {
      setValue('Default Value')
    }
  }, [formInitializing, value, setValue])

  return (
    <div>
      <h3>{label}</h3>
      <p>Current Value: {value || 'No value yet'}</p>
    </div>
  )
}

export default A
