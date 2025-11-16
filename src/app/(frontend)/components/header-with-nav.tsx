'use client'

import { useAuth } from '@/providers/auth-provider'
import { MainNav } from './main-nav'
import { UserNav } from './user-nav'
import { usePathname } from 'next/navigation'
import { HoldingsNav } from '../holdings/sub-nav-holdings'
import { MeetingsNav } from '../meetings/sub-nav-meetings'
import { ImpersonationBanner } from '@/plugins/impersonate/components'
import Link from 'next/link'
import Image from 'next/image'

export function HeaderWithNav() {
  const auth = useAuth()
  const pathname = usePathname()

  // Log the auth object to debug
  //  console.log('Auth object:', auth)

  // Don't render the top menu if the user is not logged in
  // Check if auth.user exists, is not null, and is a valid user object with expected properties
  const isValidUser =
    auth.user && typeof auth.user === 'object' && (auth.user.id || auth.user.email)

  if (!isValidUser) {
    return (
      <header className="border-b">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/emda_logo.png"
              alt="Logo"
              width={120}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </Link>
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
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/emda_logo.png"
              alt="Logo"
              width={120}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <MainNav />
        </div>
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
      <ImpersonationBanner position="top" locale="he" />
    </header>
  )
}
