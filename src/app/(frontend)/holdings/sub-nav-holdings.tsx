'use client'

import { usePathname, useRouter } from 'next/navigation'
import { FileText, Eye } from 'lucide-react'
import { cn, handleNavigation } from '@/lib/utils'

const navItems = [
  { value: 'feed', label: 'הזנת אחזקות', icon: FileText, path: '/holdings' },
  { value: 'view', label: 'צפייה באחזקות', icon: Eye, path: '/holdings/view' },
]

export function HoldingsNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleNavigationClick = (href: string, e: React.MouseEvent) => {
    handleNavigation(href, e, pathname, router)
  }

  return (
    <div className="flex justify-start pb-[15px] pr-8" dir="rtl">
      <nav className="grid grid-cols-2 gap-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path

          return (
            <button
              key={item.value}
              onClick={(e) => handleNavigationClick(item.path, e)}
              className={cn(
                'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-2 py-1 rounded-md cursor-pointer',
                isActive
                  ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4 ml-2" />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
