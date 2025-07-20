import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../../app/styles/global.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Notifications } from '@/components/notifications'
import { AuthProvider } from '@/providers/auth-provider'
import { HeaderWithNav } from './components/header-with-nav'
import { CompaniesProvider } from './context/companiesContext'
import { ImpersonationProvider } from '@/plugins/impersonate/components'

const inter = Inter({ subsets: ['latin'] })

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'מערכת ניהול אסיפות',
  description: 'מערכת מודרנית לניהול אסיפות',
  icons: {
    icon: '/favicon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`useTw ${inter.className}`} suppressHydrationWarning>
        <AuthProvider>
          <ImpersonationProvider checkInterval={600000}>
          <CompaniesProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              themes={['light', 'dark', 'system', 'blue', 'red', 'purple', 'green', 'pink']}
            >
              <div className="flex flex-col h-screen">
                <HeaderWithNav />
                <main className="flex-1 py-4">{children}</main>
              </div>
              <Notifications />
            </ThemeProvider>
          </CompaniesProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
