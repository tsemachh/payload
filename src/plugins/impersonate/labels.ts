// Centralized labels for the impersonation plugin
export const PLUGIN_LABELS = {
  en: {
    // Main actions
    impersonate: 'Impersonate',
    stopImpersonating: 'Stop Impersonating',
    switchBack: 'Switch back',
    exitImpersonation: 'Exit Impersonation',

    // User selection
    selectUser: 'Select a user to impersonate',
    selectUserToImpersonate: 'Select User to Impersonate',
    noUsers: 'No users available',
    impersonateTitle: 'Impersonate as user',

    // Status messages
    impersonating: 'Impersonating',
    youAreImpersonating: 'You are impersonating',
    original: 'Original',

    // Audit and admin
    auditAction: 'Impersonation Action',
    impersonationStart: 'Impersonation Start',
    impersonationEnd: 'Impersonation End',

    // Field labels
    action: 'Action',
    originalUser: 'Original User',
    targetUser: 'Target User',
    ipAddress: 'IP Address',
    userAgent: 'User Agent',

    // Groups
    securityGroup: 'Security',

    // Loading states
    loading: 'Loading...',

    // Confirmation dialog
    confirmationTitle: 'Impersonate User',
    confirmationDescription:
      'Impersonating this user will be logged in the security log and an alert will be sent to their company.',
    confirmationDescriptionWithUser:
      'Impersonating {userName} will be logged in the security log and an alert will be sent to their company.',
    confirmButton: 'Impersonate',
    cancelButton: 'Cancel',
  },
  he: {
    // Main actions
    impersonate: 'התחזות',
    stopImpersonating: 'הפסקת התחזות',
    switchBack: 'חזרה למשתמש המקורי',
    exitImpersonation: 'יציאה מהתחזות',

    // User selection
    selectUser: 'בחר משתמש להתחזות',
    selectUserToImpersonate: 'בחר משתמש להתחזות',
    noUsers: 'אין משתמשים זמינים',
    impersonateTitle: 'התחזה כמשתמש',

    // Status messages
    impersonating: 'מתחזה',
    youAreImpersonating: 'אתה מתחזה ל',
    original: 'מקורי',

    // Audit and admin
    auditAction: 'פעולת התחזות',
    impersonationStart: 'התחלת התחזות',
    impersonationEnd: 'סיום התחזות',

    // Field labels
    action: 'פעולה',
    originalUser: 'משתמש מקורי',
    targetUser: 'משתמש יעד',
    ipAddress: 'כתובת IP',
    userAgent: 'סוכן משתמש',

    // Groups
    securityGroup: 'אבטחה',

    // Loading states
    loading: 'טוען...',

    // Confirmation dialog
    confirmationTitle: 'התחזות למשתמש',
    confirmationDescription: 'התחזות למשתמש זה תירשם ביומן אבטחה ותשלח התרעה להחברות שלו',
    confirmationDescriptionWithUser:
      'התחזות למשתמש {userName} תירשם ביומן אבטחה ותשלח התרעה להחברות שלו',
    confirmButton: 'התחזה',
    cancelButton: 'ביטול',
  },
} as const

export type SupportedLocale = keyof typeof PLUGIN_LABELS
export type LabelKey = keyof typeof PLUGIN_LABELS.en

// Helper function to get labels for a specific locale
export const getLabels = (locale: SupportedLocale = 'en') => {
  return PLUGIN_LABELS[locale] || PLUGIN_LABELS.en
}

// Helper function to get a specific label
export const getLabel = (key: LabelKey, locale: SupportedLocale = 'en'): string => {
  const labels = getLabels(locale)
  const value = labels[key as keyof typeof labels]

  if (typeof value === 'string') {
    return value
  }

  // Fallback to English if not found
  const fallbackLabels = getLabels('en')
  const fallbackValue = fallbackLabels[key]

  return typeof fallbackValue === 'string' ? fallbackValue : String(key)
}
