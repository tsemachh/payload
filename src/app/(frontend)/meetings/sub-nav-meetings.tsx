'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { value: 'future', label: 'אסיפות עתידיות', icon: FileText, path: '/' },
  { value: 'all', label: 'כל האסיפות', icon: Eye, path: '/meetings/all' },
]

export function MeetingsNav() {
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
                'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-2 py-1 rounded-md',
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
