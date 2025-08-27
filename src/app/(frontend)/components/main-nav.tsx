'use client'

import { usePathname } from 'next/navigation'
import { BarChart3, Briefcase, Calendar, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function MainNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6 rtl:space-x-reverse">
      <Link
        href="/"
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md cursor-pointer',
          pathname === '/' || pathname === '/meetings/all'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <Calendar className="h-4 w-4 ml-2" />
        אסיפות
      </Link>
      <Link
        href="/participations"
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md cursor-pointer',
          pathname === '/participations'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <CalendarCheck className="h-4 w-4 ml-2" />
        השתתפות
      </Link>
      <Link
        href="/holdings"
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md cursor-pointer',
          pathname === '/holdings' || pathname === '/holdings/view'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <Briefcase className="h-4 w-4 ml-2" />
        החזקות
      </Link>
      <Link
        href="/dashboard"
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md cursor-pointer',
          pathname === '/dashboard'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <BarChart3 className="h-4 w-4 ml-2" />
        לוח בקרה
      </Link>
    </nav>
  )
}
