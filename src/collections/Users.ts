import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import {
  isAdmin,
  isAdminFieldLevel,
  isAdminOrSelf,
  isAdminOrSelfFieldLevel,
} from '@/utils/authUtils'
import { Company } from '@/payload-types'
import { TreeCompanyType } from '@/types/companies'
import TwoFactorSetupEndpoint from '@/collections/endpoints/TwoFactorSetupEndpoint'
import TwoFactorVerifyEndpoint from '@/collections/endpoints/TwoFactorVerifyEndpoint'
import TwoFactorDisableEndpoint from '@/collections/endpoints/TwoFactorDisableEndpoint'
import TwoFactorBackupCodesEndpoint from '@/collections/endpoints/TwoFactorBackupCodesEndpoint'
import LoginWith2FAEndpoint from '@/collections/endpoints/LoginWith2FAEndpoint'
import { getClientIP } from '@/utils/getClientIP'
import { logEvent } from '@/lib/audit/logEvent'

async function computeCompanyTreeAndLeafs(
  companyIds: string[],
  req: PayloadRequest,
): Promise<{
  funds: string[]
  treeCompanies: string
}> {
  // Query all companies and their nested subCompanies up to depth 4
  const companies = await req.payload.find({
    collection: 'companies',
    select: {
      mainAccount: false,
      silencedStocks: false,
      meetings: false,
      parentCompany: false,
      holdings: false,
      'subCompanies.id': true,
      'subCompanies.name': true,
      'subCompanies.active': true,
    },
    populate: {
      companies: {
        subCompanies: true,
        name: true,
        active: true,
      },
    },
    where: {
      and: [
        {
          id: {
            in: companyIds,
          },
        },
        {
          // active: {
          //   equals: true,
          // },
        },
      ],
    },
    limit: 0,
    depth: 1,
  })

  // Compute leaf companies recursively
  const funds: string[] = []
  const processCompanies = (company: Partial<Company>): string[] => {
    const result: string[] = []

    // If company has an id, add it to the result
    if (company.id) {
      // Check if company has subCompanies
      if (!company.subCompanies || company.subCompanies.length === 0) {
        // This is a leaf company, add its ID
        result.push(company.id)
      } else {
        // Process subCompanies recursively
        company.subCompanies.forEach((subCompany: any) => {
          result.push(...processCompanies(subCompany))
        })
      }
    }

    return result
  }

  companies.docs.forEach((doc: any) => {
    funds.push(...processCompanies(doc))
  })

  const cleanCompanyTree = (company: any): TreeCompanyType => {
    return {
      id: company.id,
      name: company.name,
      active: company.active,
      subCompanies: (company.subCompanies || []).map((sub: Company) => cleanCompanyTree(sub)),
    }
  }

  // Apply to all top-level companies
  const cleanedTree: TreeCompanyType[] = companies.docs.map((doc: Company) => cleanCompanyTree(doc))
  return {
    funds: Array.from(new Set(funds)),
    treeCompanies: JSON.stringify(cleanedTree),
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    plural: 'משתמשים',
    singular: 'משתמש',
  },
  versions: true,
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'email',
    group: 'ניהול',
    defaultColumns: ['email', 'name', 'active', 'companies', 'isAdmin', 'impersonate'],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
    components: {
      listMenuItems: [
        '/admincomponents/BulkResetPasswordMenuItem',
        '/admincomponents/BulkRecalculateUserMembershipsMenuItem',
      ],
    },
  },
  custom: {
    filterList: [
      ['active', 'isAdmin', 'createdAt'],
      ['enableAPIKey', 'receiveMailNotification'],
    ],
    defaultFilter: { active: { equals: true } },
  },
  access: {
    admin: ({ req }) => {
      // Check if user is authenticated and has allowed role
      return !!req.user?.isAdmin
    },
    // Only admins can create users
    create: isAdmin,
    // Admins can read all, but any other logged in user can only read themselves
    read: isAdminOrSelf,
    // Admins can update all, but any other logged in user can only update themselves
    update: isAdminOrSelf,
    // Only admins can delete
    delete: isAdmin,
  },
  auth: {
    useSessions: false,
    useAPIKey: true,
    tokenExpiration: process.env.NODE_ENV == 'production' ? 43200 : 432000, // 12 hours in prod, 5 days in dev timeout
    forgotPassword: {
      generateEmailHTML: async (args?: { req?: PayloadRequest; token?: string; user?: any }) => {
        if (!args?.req?.url) {
          throw new Error('Request or URL is missing')
        }
        const { req, token } = args

        const protocol = new URL(req.url!).protocol
        const serverURL =
          req.payload.config.serverURL !== null && req.payload.config.serverURL !== ''
            ? req.payload.config.serverURL
            : `${protocol}//${req.headers.get('host')}`

        // Use the user app URL instead of the admin URL
        const forgotURL = `${serverURL}/auth/reset-password/${token}`

        return `${req.t('authentication:youAreReceivingResetPassword')}
          <a href="${forgotURL}">${forgotURL}</a>
          ${req.t('authentication:youDidNotRequestPassword')}`
      },
    },
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'כללי',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  label: 'שם משתמש',
                  type: 'text',
                },
                {
                  name: 'legacyId',
                  label: 'מספר משתמש לגאסי',
                  type: 'number',
                  index: true,
                },
                {
                  name: 'active',
                  label: 'משתמש פעיל',
                  type: 'checkbox',
                  index: true,
                },
                {
                  name: 'isAdmin',
                  type: 'checkbox',
                  defaultValue: false,
                  saveToJWT: true,
                  access: {
                    create: isAdminFieldLevel,
                    update: isAdminFieldLevel,
                  },
                },
                {
                  name: 'isSystem',
                  type: 'checkbox',
                  defaultValue: false,
                  saveToJWT: true,
                  access: {
                    create: isAdminFieldLevel,
                    update: isAdminFieldLevel,
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'lastLogin',
                  label: 'התחברות אחרונה',
                  type: 'text',
                },
                {
                  name: 'changePassword',
                  label: 'שינוי סיסמה',
                  type: 'checkbox',
                  admin: { hidden: true },
                },
                {
                  name: 'receiveMailNotification',
                  label: 'קבלת התראות במייל',
                  type: 'checkbox',
                  defaultValue: true,
                },
              ],
            },
          ],
        },
        {
          label: 'חברות',
          fields: [
            {
              name: 'companies',
              label: 'חברות',
              labels: {
                plural: 'חברות',
                singular: 'חברה',
              },
              type: 'array',
              admin: {
                components: {
                  RowLabel: {
                    path: '/admincomponents/components/UserRowLabel',
                  },
                },
              },
              validate: (value) => {
                if (!Array.isArray(value)) {
                  return true // No companies selected, so valid
                }
                const ids = value.map((item) => {
                  if (typeof item !== 'object' || item === null || !('companyId' in item)) {
                    return null
                  }
                  return item.companyId
                })
                const filtered = ids.filter(Boolean)
                const unique = new Set(filtered)

                if (filtered.length !== unique.size) {
                  return 'Each company can only be selected once.'
                }

                return true
              },
              interfaceName: 'UserCompany',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      label: 'חברה',
                      name: 'companyId',
                      maxDepth: 0,
                      type: 'relationship',
                      relationTo: 'companies',
                      required: true,
                      admin: {
                        sortOptions: 'name',
                        allowCreate: false,
                      },
                      filterOptions: ({ data, siblingData, req }) => {
                        if (req.context?.from == 'migration' || req.context?.from == 'process')
                          return true
                        const currentId = (siblingData as { companyId?: string })?.companyId

                        const selectedIds = Array.isArray(data?.companies)
                          ? data.companies
                              .map((item: { companyId?: string }) => item?.companyId)
                              .filter((id: string | undefined) => id && id !== currentId)
                          : []
                        const query: Where = {
                          type: {
                            equals: 'regular',
                          },
                          /*                  active: {
                            equals: true,
                          },*/
                        }
                        if (selectedIds.length === 0) {
                          return query
                        }
                        query.id = {
                          not_in: selectedIds,
                        }
                        return query
                      },
                    },
                    {
                      name: 'permission',
                      label: 'הרשאה',
                      type: 'select',
                      options: [
                        { label: 'צפיה בהצבעות ודוחות', value: 'read' },
                        {
                          label: 'הזנת החזקות והצבעה',
                          value: 'write',
                        },
                      ],
                      defaultValue: 'write',
                    },
                  ],
                },
              ],
            },
            {
              name: 'funds',
              label: 'תיקים',
              type: 'relationship',
              relationTo: 'companies',
              maxDepth: 0,
              hasMany: true,
              admin: {
                readOnly: true,
              },
            },
            {
              name: 'treeCompanies',
              label: 'מבנה החברות כעץ מחרוזתי',
              type: 'text',
              admin: {
                hidden: true,
              },
            },
          ],
        },
        {
          label: 'IP',
          fields: [
            {
              name: 'bypassIPCheck',
              label: 'דלג על בדיקת IP למשתמש זה',
              type: 'checkbox',
              defaultValue: true,
              access: {
                create: isAdminFieldLevel,
                update: isAdminFieldLevel,
                read: isAdminOrSelfFieldLevel,
              },
            },
            {
              name: 'allowedIPs',
              label: 'כתובות IP מורשות',
              type: 'text',
              hasMany: true,
              admin: { description: 'רשימת כתובות IP המורשות למשתמש זה' },
              access: {
                read: isAdminOrSelfFieldLevel,
                create: isAdminFieldLevel,
                update: isAdminFieldLevel,
              },
              validate: (val: unknown) => {
                const v = typeof val === 'string' ? val.trim() : ''
                if (!v) return true
                const ipRegex =
                  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
                return ipRegex.test(v) ? true : 'כתובת IP לא תקינה'
              },
            },
            {
              name: 'lastLoginIP',
              label: 'כתובת IP אחרונה להתחברות',
              type: 'text',
              admin: { readOnly: true, description: 'כתובת ה-IP האחרונה שהשתמשה להתחברות' },
            },
            {
              name: 'lastLoginAt',
              label: 'מועד התחברות אחרון',
              type: 'date',
              admin: { readOnly: true },
            },
          ],
        },
        {
          label: '2FA',
          fields: [
            {
              name: 'twoFactorAuth',
              label: 'אימות דו-שלבי (2FA)',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'enabled',
                      label: 'אימות דו-שלבי מופעל',
                      type: 'checkbox',
                      defaultValue: false,
                      index: true,
                    },
                    {
                      name: 'verified',
                      label: 'אימות דו-שלבי מאומת',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: {
                        readOnly: true,
                      },
                    },
                  ],
                },
                {
                  name: 'secret',
                  label: 'מפתח סודי TOTP',
                  type: 'text',
                  admin: {
                    hidden: true,
                  },
                  access: {
                    read: ({ req }) => req.user?.isAdmin || false,
                    update: ({ req }) => req.user?.isAdmin || false,
                  },
                },
                {
                  name: 'backupCodes',
                  label: 'קודי גיבוי',
                  type: 'array',
                  admin: {
                    hidden: true,
                  },
                  access: {
                    read: ({ req }) => req.user?.isAdmin || false,
                    update: ({ req }) => req.user?.isAdmin || false,
                  },
                  fields: [
                    {
                      name: 'code',
                      label: 'קוד גיבוי',
                      type: 'text',
                    },
                    {
                      name: 'used',
                      label: 'נוצל',
                      type: 'checkbox',
                      defaultValue: false,
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'lastUsed',
                      label: 'שימוש אחרון באימות דו-שלבי',
                      type: 'date',
                      admin: {
                        readOnly: true,
                      },
                    },
                    {
                      name: 'failureCount',
                      label: 'מספר ניסיונות כושלים',
                      type: 'number',
                      defaultValue: 0,
                      admin: {
                        readOnly: true,
                      },
                    },
                  ],
                },
                {
                  name: 'lastFailureTime',
                  label: 'זמן כישלון אחרון',
                  type: 'date',
                  admin: {
                    hidden: true,
                    readOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  endpoints: [
    {
      path: '/login-2fa',
      method: 'post',
      handler: LoginWith2FAEndpoint,
    },
    {
      path: '/2fa-setup',
      method: 'post',
      handler: TwoFactorSetupEndpoint,
    },
    {
      path: '/2fa-verify',
      method: 'post',
      handler: TwoFactorVerifyEndpoint,
    },
    {
      path: '/2fa-disable',
      method: 'post',
      handler: TwoFactorDisableEndpoint,
    },
    {
      path: '/2fa-backup-codes',
      method: 'post',
      handler: TwoFactorBackupCodesEndpoint,
    },
    {
      path: '/2fa-backup-codes',
      method: 'get',
      handler: TwoFactorBackupCodesEndpoint,
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (
          (req.context.from == 'migration' || req.context.from == 'process') &&
          data.funds?.length > 0
        ) {
          return data
        }
        if (data?.companies) {
          const companiesChanged =
            originalDoc && JSON.stringify(originalDoc.companies) !== JSON.stringify(data?.companies)

          if (companiesChanged || !data?.funds || data?.funds.length === 0) {
            const companyIds = data?.companies.map((company: any) => company.companyId)
            const { funds, treeCompanies } = await computeCompanyTreeAndLeafs(companyIds, req)
            data.funds = funds
            data.treeCompanies = treeCompanies
          }
        }
        // If 2FA is explicitly disabled, clear its related fields
        if (data?.twoFactorAuth && data.twoFactorAuth.enabled === false) {
          data.twoFactorAuth = {
            enabled: false,
            verified: false,
            secret: null as any,
            backupCodes: [],
            lastUsed: null as any,
            failureCount: 0,
            lastFailureTime: null as any,
          }
        }
        return data
      },
    ],
    beforeLogin: [
      async ({ user, req }) => {
        req.payload.logger.info('beforeLogin hook called for user:', user.email)

        if (!user.active) {
          throw new APIError('המשתמש אינו פעיל, אנא פנה למנהל המערכת', 403)
        }
        if (user.isSystem) {
          throw new APIError('המשתמש מערכת אינו מורשה, אנא פנה למנהל המערכת', 403)
        }

        // Enforce per-user IP allowlist (if configured)
        const clientIP = getClientIP(req)
        req.payload.logger.info(`user client IP:${clientIP} for user: ${user.email}`)
        const bypass = user.bypassIPCheck === true
        if (!bypass && Array.isArray(user.allowedIPs) && user.allowedIPs.length > 0) {
          const allowedList = (user.allowedIPs as any[])
            .map((e: any) => (typeof e === 'string' ? e : e?.ip))
            .filter(Boolean)
          // In development, allow localhost connections
          const isDevelopmentLocalhost =
            process.env.NODE_ENV === 'development' && clientIP === '127.0.0.1'
          const allowed = allowedList.includes(clientIP) || isDevelopmentLocalhost
          if (!allowed) {
            // No admin notification here; log to audit-logs only
            await logEvent({
              eventType: 'auth.login.failure',
              severity: 'warning',
              category: 'auth',
              actor: user.id as any,
              success: false,
              message: `Login blocked: unauthorized IP ${clientIP}`,
              details: { email: user.email, clientIP },
              req,
              source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
            })
            // Debounce to avoid double logging in afterError
            req.context = req.context || {}
            req.context.__loginFailureLogged = true
            throw new APIError(`הגישה נדחתה: כתובת IP ${clientIP}  אינה מורשית `, 403)
          }
        }

        // Check if this is admin login (via admin routes) vs frontend login
        const isAdminLogin =
          req.url?.includes('/admin') || req.headers.get('referer')?.includes('/admin')

        if (isAdminLogin) {
          // Skip 2FA verification in beforeLogin for admin context
          // This will be handled by the AdminTwoFactor component after login
          req.payload.logger.info('Admin login detected, 2FA check will be handled post-login')
        } else {
          // For frontend login, check 2FA status
          if (user.twoFactorAuth?.enabled && !user.twoFactorAuth?.verified) {
            // User has started 2FA setup but not completed - allow login but indicate setup needed
            req.payload.logger.info(
              'Frontend user has 2FA enabled but not verified, allowing login for setup completion',
            )
            // Don't throw error - let login succeed so user can authenticate for setup
            // The frontend will detect this state and show setup interface
          } else if (user.twoFactorAuth?.enabled && user.twoFactorAuth?.verified) {
            req.payload.logger.info('Frontend user has 2FA enabled, checking for TOTP code')

            // Get the request body to check for totpCode
            const body = req.data || {}
            const { totpCode } = body

            if (!totpCode) {
              req.payload.logger.info('No TOTP code provided, requiring 2FA')
              throw new APIError('נדרש אימות דו-שלבי', 428, { requires2FA: true })
            }

            req.payload.logger.info('TOTP code provided, verifying...')

            // Verify the TOTP code inline
            const { verifyTOTPToken, decryptTOTPSecret, checkRateLimit } = await import(
              '@/utils/totpUtils'
            )

            // Check rate limiting
            const rateLimitCheck = checkRateLimit(
              user.twoFactorAuth.failureCount || 0,
              user.twoFactorAuth.lastFailureTime
                ? new Date(user.twoFactorAuth.lastFailureTime)
                : undefined,
            )

            if (rateLimitCheck.isLocked) {
              throw new APIError(
                `חשבון נחסם זמנית. נסה שוב בעוד ${rateLimitCheck.remainingTime} דקות`,
                429,
              )
            }

            try {
              const decryptedSecret = decryptTOTPSecret(user.twoFactorAuth.secret!)
              const isValid = verifyTOTPToken(totpCode, decryptedSecret)

              if (!isValid) {
                // Increment failure count
                const newFailureCount = (user.twoFactorAuth.failureCount || 0) + 1

                await req.payload.update({
                  collection: 'users',
                  id: user.id,
                  data: {
                    twoFactorAuth: {
                      ...user.twoFactorAuth,
                      failureCount: newFailureCount,
                      lastFailureTime: new Date().toISOString(),
                    },
                  },
                })

                throw new APIError('קוד אימות דו-שלבי שגוי', 401)
              }

              req.payload.logger.info('2FA verification successful, allowing frontend login')

              // Reset failure count on successful verification
              await req.payload.update({
                collection: 'users',
                id: user.id,
                data: {
                  twoFactorAuth: {
                    ...user.twoFactorAuth,
                    lastUsed: new Date().toISOString(),
                    failureCount: 0,
                  },
                },
              })
            } catch (error) {
              req.payload.logger.error('2FA verification error:', error)
              throw new APIError('שגיאה באימות הקוד', 500)
            }
          }
        }

        req.payload.logger.info('beforeLogin hook completed successfully')
        return user
      },
    ],
    afterLogin: [
      async ({ req, user }) => {
        const clientIP = getClientIP(req)
        try {
          await req.payload.update({
            collection: 'users',
            id: user.id,
            data: {
              lastLoginIP: clientIP,
              lastLoginAt: new Date().toISOString(),
            },
          })
        } catch (e) {
          req.payload.logger.warn('Failed to update last login info', e)
        }
        req.payload.logger.info(`Successful login from IP ${clientIP} for ${user.email}`)
        await logEvent({
          eventType: 'auth.login.success',
          severity: 'info',
          category: 'auth',
          actor: user.id as any,
          success: true,
          message: `Login success for ${user.email}`,
          details: { clientIP },
          req,
          source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
        })
      },
    ],
    afterLogout: [
      async ({ req }) => {
        try {
          await logEvent({
            eventType: 'auth.logout',
            category: 'auth',
            severity: 'info',
            actor: (req.user as any)?.id || req?.user?.id || null,
            success: true,
            message: req.user?.email ? `Logout for ${req.user.email}` : 'User logged out',
            req,
            source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
          })
        } catch (e) {
          req?.payload?.logger?.warn?.({ e }, 'Failed to write logout audit log')
        }
      },
    ],
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        try {
          if (req.context.from == 'migration') return
          // Case 1: New user created
          if (operation === 'create') {
            await logEvent({
              eventType: 'user.create',
              category: 'user',
              severity: 'info',
              targetCollection: 'users',
              targetId: String(doc.id),
              message: `משתמש חדש נוצר: ${doc.email}`,
              details: { email: doc.email, isAdmin: doc.isAdmin, active: doc.active },
              req,
              source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
            })
            return
          }

          // Case 2: User permissions changed
          if (operation === 'update' && previousDoc) {
            const changes = []

            // Check if active status changed
            if (doc.active !== previousDoc.active) {
              const status = doc.active ? 'פעיל' : 'לא פעיל'
              changes.push(`סטטוס שונה ל-${status}`)
            }

            // Check if isAdmin status changed
            if (doc.isAdmin !== previousDoc.isAdmin) {
              const status = doc.isAdmin ? 'מנהל' : 'לא מנהל'
              changes.push(`הרשאת מנהל שונתה ל-${status}`)
            }

            // Check if companies changed
            const companiesChanged =
              JSON.stringify(doc.companies) !== JSON.stringify(previousDoc.companies)
            if (companiesChanged) {
              changes.push('הרשאות חברות שונו')
            }

            // If any changes were detected, log to audit (no admin notification)
            if (changes.length > 0) {
              await logEvent({
                eventType: 'user.update',
                category: 'user',
                severity: 'info',
                targetCollection: 'users',
                targetId: String(doc.id),
                message: `הרשאות משתמש שונו עבור ${doc.email}: ${changes.join(', ')}`,
                details: { changes },
                req,
                source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
              })
            }
          }
        } catch (error) {
          console.error('Error creating notification for user changes:', error)
        }
      },
    ],
    afterError: [
      async ({ req, error }) => {
        try {
          const status =
            (error as any)?.status ||
            (error instanceof APIError ? (error as any).status : undefined)

          // Log access.denied for 401/403
          if (status === 401 || status === 403) {
            await logEvent({
              eventType: 'access.denied',
              category: 'security',
              severity: status === 401 ? 'warning' : 'high',
              success: false,
              message: (error as any)?.message || 'Access denied',
              details: {
                status,
                email: (req.data && (req.data.email || req.data.username)) || undefined,
              },
              req,
              source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
            })
          }

          // Log login failure if not already explicitly logged
          req.context = req.context || {}
          if (!req.context.__loginFailureLogged) {
            const email = (req.data && (req.data.email || req.data.username)) || undefined
            await logEvent({
              eventType: 'auth.login.failure',
              severity: status === 401 || status === 403 ? 'warning' : 'info',
              category: 'auth',
              success: false,
              message: `Login failed${status ? ` (${status})` : ''}${email ? ` for ${email}` : ''}`,
              details: { status, email, reason: (error as any)?.message },
              req,
              source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
            })
          }
        } catch (e) {
          req?.payload?.logger?.warn?.({ e }, 'Failed to write audit logs for login error')
        }
      },
    ],
  },
}
