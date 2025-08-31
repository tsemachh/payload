'use client'

import { usePathname } from 'next/navigation'
import { Eye, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const navItems = [
  { value: 'feed', label: 'הזנת החזקות', icon: FileText, path: '/holdings' },
  { value: 'view', label: 'צפייה בהחזקות', icon: Eye, path: '/holdings/view' },
]

export function HoldingsNav() {
  const pathname = usePathname()

  return (
    <div className="flex justify-start pb-[15px] pr-8" dir="rtl">
      <nav className="grid grid-cols-2 gap-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path

          return (
            <Link
              key={item.value}
              href={item.path}
              className={cn(
                'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-2 py-1 rounded-md cursor-pointer',
                isActive
                  ? 'text-primary bg-primary/10 shadow-sm border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4 ml-2" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
