'use client'
import React, { useEffect, useCallback } from 'react'
import { useNav } from '@payloadcms/ui'

export const NavCloser: React.FC = ({}) => {
  const { setNavOpen } = useNav()

  // Using useCallback to memoize the effect function
  const closeNav = useCallback(() => {
    setNavOpen(false)
  }, [setNavOpen])

  useEffect(() => {
    closeNav()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally empty to run only on mount
  return null
}
export default NavCloser
