'use client'

import React, { useEffect } from 'react'
import { TextFieldClientProps } from 'payload'
import { useField } from '@payloadcms/ui'

const Subtitle: React.FC<TextFieldClientProps> = (props) => {
  const { path } = props
  const { value } = useField<string>({
    path,
  })

  useEffect(() => {
    // Select the target div with the specified classes
    const headerDiv = document.querySelector('.gutter.gutter--left.gutter--right.doc-header')

    if (!headerDiv) {
      console.warn('Header div not found')
      return
    }

    // Find the h1 element
    const h1Element = headerDiv.querySelector('h1.doc-header__title')

    if (!h1Element) {
      console.warn('H1 element not found')
      return
    }

    // Check if an h2 already exists to avoid duplicates
    let h2Element = headerDiv.querySelector('h2.doc-header__subtitle')

    if (!h2Element) {
      // Create a new h2 element
      h2Element = document.createElement('h2')
      h2Element.className = 'doc-header__subtitle'
      //h2Element.style.marginTop = '10px' // Optional styling
      // Insert the h2 right after the h1
      h1Element.insertAdjacentElement('afterend', h2Element)
    }

    // Update the h2 content with the value
    h2Element.textContent = value || 'No subtitle provided'
  }, [value]) // Re-run when value changes

  // Return null since this component only manipulates the DOM
  return null
}

export default Subtitle
