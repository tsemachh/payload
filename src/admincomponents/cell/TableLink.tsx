import type React from 'react'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface TableLinkProps {
  href: string
  children: React.ReactNode
  external?: boolean
  className?: string
  variant?: 'default' | 'muted' | 'destructive'
}

export function TableLink({
  href,
  children,
  external = false,
  className,
  variant = 'default',
}: TableLinkProps) {
  const baseStyles =
    'inline-flex items-center gap-1 font-medium transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-2'

  const variantStyles = {
    default: 'text-primary hover:text-primary/80',
    muted: 'text-muted-foreground hover:text-foreground',
    destructive: 'text-destructive hover:text-destructive/80',
  }

  const linkContent = (
    <>
      {children}
      {external && <ExternalLink className="h-3 w-3" />}
    </>
  )

  const combinedClassName = cn(baseStyles, variantStyles[variant], className)

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={combinedClassName}>
        {linkContent}
      </a>
    )
  }

  return (
    <Link href={href} className={combinedClassName}>
      {linkContent}
    </Link>
  )
}
