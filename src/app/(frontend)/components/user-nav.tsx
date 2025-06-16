'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { useAuth } from '@/providers/auth-provider'
import { ThemeChooser } from '@/components/theme-chooser'

export function UserNav() {
  const { user } = useAuth()

  if (!user) {
    return (
      <>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/auth/signin">התחבר</Link>
        </Button>
        <ThemeChooser />
      </>
    )
  }

  const userInitial = user.name?.charAt(0) || user.email?.charAt(0) || 'U'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/account">החשבון שלי</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <DropdownMenuLabel>
                <ThemeChooser />
                <span className="text-right">בחר ערכת נושא</span>
              </DropdownMenuLabel>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/auth/logout">התנתק</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
