'use client'

import { useTranslation } from '@payloadcms/ui'

export const useLocale = () => {
  const { i18n } = useTranslation()
  return i18n.language || 'en'
}
