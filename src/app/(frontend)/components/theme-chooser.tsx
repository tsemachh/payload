'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Palette } from 'lucide-react'

export function ThemeChooser() {
  const { setTheme } = useTheme()

  return (
    <div className="ml-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Palette className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <div className="mr-2 h-4 w-4 rounded-full bg-gray-100 border border-gray-300" />
            <span>Light</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <div className="mr-2 h-4 w-4 rounded-full bg-gray-900" />
            <span>Dark</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-900" />
            <span>System</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('blue')}>
            <div className="mr-2 h-4 w-4 rounded-full bg-blue-400" />
            <span>Blue</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('red')}>
            <div className="mr-2 h-4 w-4 rounded-full bg-red-500" />
            <span>Red</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('green')}>
            <div className="mr-2 h-4 w-4 rounded-full bg-green-500" />
            <span>Green</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('purple')}>
            <div className="mr-2 h-4 w-4 rounded-full bg-purple-500" />
            <span>Purple</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('pink')}>
            <div className="mr-2 h-4 w-4 rounded-full bg-pink-500" />
            <span>Pink</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
