import type { User } from '@/payload-types'

export type Create = (args: {
  email: string
  password: string
  firstName: string
  lastName: string
}) => Promise<User>

export type Login = (args: { email: string; password: string }) => Promise<User>

export type Logout = () => Promise<void>

export type ForgotPassword = (args: { email: string }) => Promise<boolean>

export type ResetPassword = (args: { password: string; token: string }) => Promise<User>

export interface AuthContext {
  user: User | null | undefined
  setUser: React.Dispatch<React.SetStateAction<User | null | undefined>>
  login: Login
  logout: Logout
  create: Create
  forgotPassword: ForgotPassword
  resetPassword: ResetPassword
}
