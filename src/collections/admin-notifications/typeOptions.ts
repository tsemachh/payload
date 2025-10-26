import type { AdminNotificationType } from '@/payload-types'

// Single source of truth for Admin Notification types and their Hebrew labels
// Reuse everywhere (collection select options + email sections)
export const adminNotificationTypeOptions: ReadonlyArray<{
  value: AdminNotificationType
  label: string
}> = [
  { value: 'newVoteAfterHoldingLimit', label: 'הצבעה לטיפול' },
  { value: 'predictaFeed', label: 'העדר הזנת מערכת נ״ע ואסיפות' },
  { value: 'companyNotReportedHoldings', label: 'העדר דווח החזקות' },
  { value: 'companyNotVotedMeetingNextDay', label: 'העדר הצבעה' },
  { value: 'meetingToPublish', label: 'אסיפה לפירסום' },
] as const

export const ADMIN_NOTIFICATION_KNOWN_TYPES: ReadonlySet<NonNullable<AdminNotificationType>> = new Set(
  adminNotificationTypeOptions.map((o) => o.value).filter(Boolean) as NonNullable<AdminNotificationType>[],
)

export function getAdminNotificationTypeLabel(type: AdminNotificationType | undefined | null): string {
  const opt = adminNotificationTypeOptions.find((o) => o.value === type)
  return opt?.label ?? 'אחר'
}
