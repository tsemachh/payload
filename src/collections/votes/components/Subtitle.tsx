'use client'

import React, { useEffect } from 'react'
import { TextFieldClientProps } from 'payload'
import { useField } from '@payloadcms/ui'

const Subtitle: React.FC<TextFieldClientProps> = (props) => {
  const { path } = props
  const { value } = useField<string>({ path })

  useEffect(() => {
    const drawerHeader = document.querySelector<HTMLElement>('.doc-drawer__header')
    const isVoteDrawer = Boolean(
      drawerHeader?.querySelector<HTMLAnchorElement>('.id-label a[href*="/collections/votes/"]'),
    )
    if (!isVoteDrawer || !drawerHeader) return

    const container = drawerHeader.querySelector<HTMLElement>('.doc-drawer__header-content')
    const titleEl = container?.querySelector<HTMLElement>('h2.doc-drawer__header-text')
    if (!container || !titleEl) return

    container.style.display = 'flex'
    container.style.flexDirection = 'row'
    container.style.flexWrap = 'wrap'

    const tag = 'h3'
    const subtitleClass = 'doc-drawer__subtitle'
    let subtitleEl = container.querySelector<HTMLElement>(`${tag}.${subtitleClass}`)
    if (!subtitleEl) {
      subtitleEl = document.createElement(tag)
      subtitleEl.className = subtitleClass
      titleEl.insertAdjacentElement('afterend', subtitleEl)
    }

    subtitleEl.textContent = value || 'No subtitle provided'

    Object.assign(subtitleEl.style, {
      flexBasis: '100%',
      order: '1',
      marginTop: '0.25rem',
      fontSize: '1.2rem',
      opacity: '0.75',
    })
  }, [value])

  return null
}

export default Subtitle
