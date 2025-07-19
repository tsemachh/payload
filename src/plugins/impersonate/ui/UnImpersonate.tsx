import type { PayloadServerReactComponent, SanitizedConfig } from 'payload'
import type { CSSProperties } from 'react'
import { cookies } from 'next/headers'
import { getLabels } from '../labels'

const style: CSSProperties | undefined = {
  alignItems: 'center',
  borderBottom: '1px solid var(--theme-elevation-100)',
  display: 'flex',
  height: '30px',
  justifyContent: 'center',
}

export const UnImpersonate: PayloadServerReactComponent<
  SanitizedConfig['admin']['components']['header'][0]
> = async ({ user, payload, clientProps }) => {
  const { email } = user
  const appCookies = await cookies()

  if (!appCookies.has('impersonate')) {
    return null
  }

  const userId = appCookies.get('impersonate')

  // Get current locale from payload config
  const currentLocale = payload.config.i18n?.supportedLanguages
    ? (Object.keys(payload.config.i18n.supportedLanguages)[0] as 'en' | 'he') || 'en'
    : 'en'

  // Get centralized labels
  const currentLabels = getLabels(currentLocale)

  // Get authCollection from clientProps or default to 'users'
  const authCollectionSlug = clientProps?.authCollection || 'users'

  return (
    <div style={{ ...style }}>
      <span>
        {currentLabels.impersonating as string} <strong>{email}</strong>{' '}
        <a
          className="admin-action"
          href={`/api/${authCollectionSlug}/unImpersonate/${userId?.value}`}
          style={{
            color: 'var(--theme-text)',
            textDecoration: 'underline',
            marginLeft: '8px',
          }}
        >
          {currentLabels.switchBack as string}
        </a>
      </span>
    </div>
  )
}
