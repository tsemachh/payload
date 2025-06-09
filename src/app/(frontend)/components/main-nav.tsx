'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Calendar, CalendarCheck, BarChart3, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MainNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleNavigation = (href: string, e: React.MouseEvent) => {
    // Check if we're on holdings page and there's a navigation handler
    if (
      pathname === '/holdings' &&
      typeof window !== 'undefined' &&
      (window as unknown as Record<string, unknown>).holdingsNavigationHandler
    ) {
      const canNavigate = (
        (window as unknown as Record<string, unknown>).holdingsNavigationHandler as (
          href: string,
        ) => boolean
      )(href)
      if (!canNavigate) {
        e.preventDefault()
        return
      }
    }
    router.push(href)
  }

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6 rtl:space-x-reverse">
      <button
        onClick={(e) => handleNavigation('/', e)}
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md cursor-pointer',
          pathname === '/' || pathname === '/meetings/all'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <Calendar className="h-4 w-4 ml-2" />
        אסיפות
      </button>
      <button
        onClick={(e) => handleNavigation('/participations', e)}
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md cursor-pointer',
          pathname === '/participations'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <CalendarCheck className="h-4 w-4 ml-2" />
        השתתפויות
      </button>
      <button
        onClick={(e) => handleNavigation('/holdings', e)}
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md cursor-pointer',
          pathname === '/holdings' || pathname === '/holdings/view'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <Briefcase className="h-4 w-4 ml-2" />
        אחזקות
      </button>
      <button
        onClick={(e) => handleNavigation('/dashboard', e)}
        className={cn(
          'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md cursor-pointer',
          pathname === '/dashboard'
            ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        <BarChart3 className="h-4 w-4 ml-2" />
        לוח בקרה
      </button>
    </nav>
  )
}
