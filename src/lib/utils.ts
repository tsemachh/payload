import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumberWithLocale(
  value: number | string,
  fractionDigits: number = 2,
  locale = 'he-IL',
): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (isNaN(num)) return ''
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num)
}
