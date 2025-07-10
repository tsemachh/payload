'use client'
import React from 'react'
import { TextFieldClientProps } from 'payload'
import { useField } from '@payloadcms/ui'

const Subtitle: React.FC<TextFieldClientProps> = (props) => {
  console.log('props', props)
  const { path } = props
  const titlePath = path.replace(/subTitle$/, 'title')

  const { value } = useField<string>({
    path,
  })
  const { value: title } = useField<string>({
    path: titlePath,
  })

  return `${value}: ${title};`
}

export default Subtitle
