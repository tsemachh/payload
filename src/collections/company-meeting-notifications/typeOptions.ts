import type { UserNotificationType } from '@/payload-types'

// Single source of truth for Company Meeting Notification types and their Hebrew labels
// Reuse everywhere (collection select options + email sections)
export const companyNotificationTypeOptions: ReadonlyArray<{
  value: UserNotificationType
  label: string
}> = [
  { value: 'after-holding-limit', label: 'הצבעה נדרשת' },
  { value: 'before-voting-end', label: 'הצבעה תנעל בקרוב' },
  { value: 'holdings-not-fed', label: 'העדר הזנת החזקות' },
  { value: 'user-impersonation', label: 'כניסה לחשבון שלך' },
  { value: 'meeting-updated', label: 'עדכון באסיפה ' },
  { value: 'holdings-gap', label: 'פערי החזקות' },
] as const

export const COMPANY_NOTIFICATION_KNOWN_TYPES: ReadonlySet<NonNullable<UserNotificationType>> = new Set(
  companyNotificationTypeOptions.map((o) => o.value).filter(Boolean) as NonNullable<UserNotificationType>[],
)

export function getCompanyNotificationTypeLabel(
  type: UserNotificationType | undefined | null,
): string {
  const opt = companyNotificationTypeOptions.find((o) => o.value === type)
  return opt?.label ?? 'אחר'
}
