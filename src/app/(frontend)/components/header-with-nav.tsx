'use client'

import { useAuth } from '@/providers/auth-provider'
import { MainNav } from './main-nav'
import { ThemeChooser } from '@/components/theme-chooser'
import { UserNav } from './user-nav'
import { usePathname } from 'next/navigation'
import { HoldingsNav } from '../holdings/sub-nav-holdings'
import { MeetingsNav } from '../meetings/sub-nav-meetings'

export function HeaderWithNav() {
  const auth = useAuth()
  const pathname = usePathname()

  // Log the auth object to debug
  console.log('Auth object:', auth)

  // Don't render the top menu if the user is not logged in
  // Check if auth.user exists, is not null, and is a valid user object with expected properties
  const isValidUser =
    auth.user && typeof auth.user === 'object' && (auth.user.id || auth.user.email)

  if (!isValidUser) {
    return (
      <header className="border-b">
        <div className="flex h-16 items-center justify-between px-4">
          <div></div>
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
            <UserNav />
          </div>
        </div>
      </header>
    )
  }

  // Render the top menu if the user is logged in
  return (
    <header className="border-b">
      <div className="flex h-16 items-center justify-between px-4">
        <MainNav />
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <UserNav />
        </div>
      </div>
      {pathname == '/' || pathname == '/meetings/all' ? (
        <div className="flex h-8 items-center justify-between px-4">
          <MeetingsNav />
        </div>
      ) : (
        pathname.startsWith('/holdings') && (
          <div className="flex h-8 items-center justify-between px-4">
            <HoldingsNav />
          </div>
        )
      )}
    </header>
  )
}
