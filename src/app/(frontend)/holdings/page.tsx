'use client'

import { useState } from 'react'
import { FileText, Eye } from 'lucide-react'
import { HoldingsFeedView } from './components/HoldingsFeedView'
import { HoldingsView } from './components/HoldingsView'
import { cn } from '@/lib/utils'

export default function Holdings() {
  const [activeTab, setActiveTab] = useState('feed')

  // SubNav items with icons
  const navItems = [
    { value: 'feed', label: 'הזנת אחזקות', icon: FileText },
    { value: 'view', label: 'צפייה באחזקות', icon: Eye },
  ]

  return (
    <div className="space-y-6 mr-5">
      <div className="flex justify-start" dir="rtl">
        <nav className="grid grid-cols-2 gap-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.value

            return (
              <button
                key={item.value}
                onClick={() => setActiveTab(item.value)}
                className={cn(
                  'flex items-center text-sm font-medium transition-all duration-200 hover:text-primary px-3 py-2 rounded-md',
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

      <div className="mt-6">
        {activeTab === 'feed' && <HoldingsFeedView />}
        {activeTab === 'view' && <HoldingsView />}
      </div>
    </div>
  )
}
