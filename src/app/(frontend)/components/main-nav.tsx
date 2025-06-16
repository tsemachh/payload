'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Calendar, CalendarCheck, BarChart3, Briefcase } from 'lucide-react'
import { cn, handleNavigation } from '@/lib/utils'

export function MainNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleNavigationClick = (href: string, e: React.MouseEvent) => {
    handleNavigation(href, e, pathname, router)
  }

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6 rtl:space-x-reverse">
      <button
        onClick={(e) => handleNavigationClick('/', e)}
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
        onClick={(e) => handleNavigationClick('/participations', e)}
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
        onClick={(e) => handleNavigationClick('/holdings', e)}
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
        onClick={(e) => handleNavigationClick('/dashboard', e)}
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
