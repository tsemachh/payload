import type { User } from '@/payload-types'

export type Create = (args: {
  email: string
  password: string
  firstName: string
  lastName: string
}) => Promise<User>

export type Login = (args: { email: string; password: string; totpCode?: string }) => Promise<User>

export type LoginWith2FA = (args: { 
  email: string; 
  password: string;
  totpCode?: string;
  backupCode?: string;
}) => Promise<{ user?: User; requiresTwoFactor?: boolean; requiresSetup?: boolean; remainingBackupCodes?: number }>

export type Verify2FA = (args: {
  token: string;
  isBackupCode?: boolean;
  enableAfterVerification?: boolean;
}) => Promise<boolean>

export type Setup2FA = () => Promise<{
  qrCode: string;
  manualEntryKey: string;
  backupCodes: string[];
}>

export type Disable2FA = (args: { currentPassword: string }) => Promise<boolean>

export type RegenerateBackupCodes = () => Promise<string[]>

export type Logout = () => Promise<void>

export type ForgotPassword = (args: { email: string }) => Promise<boolean>

export type ResetPassword = (args: { password: string; token: string }) => Promise<User>

export interface AuthContext {
  user: User | null | undefined
  setUser: React.Dispatch<React.SetStateAction<User | null | undefined>>
  login: Login
  loginWith2FA: LoginWith2FA
  verify2FA: Verify2FA
  setup2FA: Setup2FA
  disable2FA: Disable2FA
  regenerateBackupCodes: RegenerateBackupCodes
  logout: Logout
  create: Create
  forgotPassword: ForgotPassword
  resetPassword: ResetPassword
}
