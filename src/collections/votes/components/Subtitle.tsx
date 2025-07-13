'use client'

import React, { useEffect } from 'react'
import { TextFieldClientProps } from 'payload'
import { useField } from '@payloadcms/ui'

const Subtitle: React.FC<TextFieldClientProps> = (props) => {
  const { path } = props
  const { value } = useField<string>({ path })

  useEffect(() => {
    // 1. זיהוי drawer של vote
    const drawerHeader = document.querySelector<HTMLElement>('.doc-drawer__header')
    const isVoteDrawer = Boolean(
      drawerHeader?.querySelector<HTMLAnchorElement>('.id-label a[href*="/collections/votes/"]'),
    )
    if (!isVoteDrawer || !drawerHeader) return

    // 2. בחירת הקונטיינר והכותרת
    const container = drawerHeader.querySelector<HTMLElement>('.doc-drawer__header-content')
    const titleEl = container?.querySelector<HTMLElement>('h2.doc-drawer__header-text')
    if (!container || !titleEl) return

    // 3. הכנס display:flex כדי לאפשר flex-wrap
    container.style.display = 'flex'
    container.style.flexDirection = 'row'
    container.style.flexWrap = 'wrap'

    // 4. יצירת subtitle אם צריך
    const tag = 'h3'
    const subtitleClass = 'doc-drawer__subtitle'
    let subtitleEl = container.querySelector<HTMLElement>(`${tag}.${subtitleClass}`)
    if (!subtitleEl) {
      subtitleEl = document.createElement(tag)
      subtitleEl.className = subtitleClass
      titleEl.insertAdjacentElement('afterend', subtitleEl)
    }

    // 5. עדכון התוכן
    subtitleEl.textContent = value || 'No subtitle provided'

    // 6. סגנון: force line‑break + order + קטנטן
    Object.assign(subtitleEl.style, {
      flexBasis: '100%', // שורה חדשה
      order: '1', // אחרי הכותרת
      marginTop: '0.25rem', // ריווח עדין
      fontSize: '0.875rem', // גודל טקסט קטן יותר
      opacity: '0.75', // קצת שקיפות (אופציונלי)
    })
  }, [value])

  return null
}

export default Subtitle
