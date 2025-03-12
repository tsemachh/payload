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

const themes = [
  { name: 'Light', value: 'light', color: 'bg-gray-100 border border-gray-300' },
  { name: 'Dark', value: 'dark', color: 'bg-gray-900' },
  { name: 'System', value: 'system', color: 'bg-gradient-to-br from-gray-100 to-gray-900' },
  { name: 'Blue', value: 'blue', color: 'bg-blue-400' },
  { name: 'Red', value: 'red', color: 'bg-red-500' },
  { name: 'Green', value: 'green', color: 'bg-green-500' },
  { name: 'Purple', value: 'purple', color: 'bg-purple-500' },
  { name: 'Pink', value: 'pink', color: 'bg-pink-500' },
]

export function ThemeChooser() {
  const { setTheme, theme } = useTheme()
  const defaultTheme = 'blue'

  React.useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || defaultTheme
    setTheme(storedTheme)
  }, [setTheme])

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

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
          {themes.map(({ name, value, color }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => handleThemeChange(value)}
              className="flex items-center"
            >
              <div className={`mr-2 h-4 w-4 rounded-full ${color}`} />
              <span>{name}</span>
              {theme === value && <span className="ml-auto">✔</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
