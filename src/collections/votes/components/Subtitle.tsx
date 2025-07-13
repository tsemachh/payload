'use client'

import React, { useEffect } from 'react'
import { TextFieldClientProps } from 'payload'
import { useField } from '@payloadcms/ui'

const Subtitle: React.FC<TextFieldClientProps> = (props) => {
  const { path } = props
  const { value } = useField<string>({ path })

  useEffect(() => {
    const headerDiv = document.querySelector<HTMLElement>(
      '.gutter.gutter--left.gutter--right.doc-header',
    )
    if (!headerDiv) return

    headerDiv.style.display = 'flex'
    headerDiv.style.flexDirection = 'row'
    headerDiv.style.flexWrap = 'wrap'

    const h1 = headerDiv.querySelector<HTMLElement>('h1.doc-header__title')
    if (!h1) return

    let h2 = headerDiv.querySelector<HTMLElement>('h2.doc-header__subtitle')
    if (!h2) {
      h2 = document.createElement('h2')
      h2.className = 'doc-header__subtitle'
      h1.insertAdjacentElement('afterend', h2)
    }
    h2.textContent = value || 'No subtitle provided'

    h2.style.flexBasis = '100%'
    h2.style.order = '1'
    h2.style.marginTop = '0.5rem'

    const tabs = headerDiv.querySelector<HTMLElement>('.doc-tabs')
    if (tabs) {
      tabs.style.order = '2'
      tabs.style.flexBasis = '100%'
    }
  }, [value])

  return null
}

export default Subtitle
