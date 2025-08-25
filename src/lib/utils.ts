import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function handleNavigation(
  href: string,
  e: React.MouseEvent,
  pathname: string,
  router: AppRouterInstance,
) {
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

  // Check if we're on vote-meeting page and there's a navigation handler
  if (
    pathname.startsWith('/vote-meeting/') &&
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).voteNavigationHandler
  ) {
    const canNavigate = (
      (window as unknown as Record<string, unknown>).voteNavigationHandler as (
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
