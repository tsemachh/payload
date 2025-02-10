'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export function MainNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6 rtl:space-x-reverse">
      <Link
        href="/"
        className={cn(
          'text-sm font-medium transition-colors hover:text-primary px-3 py-2',
          pathname === '/' ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        אסיפות עתידיות
      </Link>
      <Link
        href="/participations"
        className={cn(
          'text-sm font-medium transition-colors hover:text-primary px-3 py-2',
          pathname === '/participations' ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        השתתפויות
      </Link>
      <Link
        href="/holdings"
        className={cn(
          'text-sm font-medium transition-colors hover:text-primary px-3 py-2',
          pathname === '/holdings' ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        אחזקות
      </Link>
      <Link
        href="/dashboard"
        className={cn(
          'text-sm font-medium transition-colors hover:text-primary px-3 py-2',
          pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        לוח בקרה
      </Link>
    </nav>
  )
}
