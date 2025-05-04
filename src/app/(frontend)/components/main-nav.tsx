'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, CalendarCheck, BarChart3, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MainNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6 rtl:space-x-reverse">
      <Link
        href="/"
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md',
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
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md',
          pathname === '/participations'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <CalendarCheck className="h-4 w-4 ml-2" />
        השתתפויות
      </Link>
      <Link
        href="/holdings"
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md',
          pathname === '/holdings' || pathname === '/holdings/view'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <Briefcase className="h-4 w-4 ml-2" />
        אחזקות
      </Link>
      <Link
        href="/dashboard"
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md',
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
