import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../../app/styles/global.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Notifications } from '@/components/notifications'
import { AuthProvider } from '@/providers/auth-provider'
import { HeaderWithNav } from './components/header-with-nav'
import { CompaniesProvider } from './context/companiesContext'
import { ErrorDialogProvider } from './context/error-dialog-context'
import { ImpersonationProvider } from '@/plugins/impersonate/components'
import { NavigationGuardProvider } from 'next-navigation-guard'

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
  const appVersion = process.env.APP_VERSION || process.env.BUILD_TIME || Date.now().toString()
  
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="app-version" content={appVersion} />
      </head>
      <body className={`useTw ${inter.className}`} suppressHydrationWarning>
        <AuthProvider>
          <ImpersonationProvider checkInterval={600000}>
          <CompaniesProvider>
            <ErrorDialogProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
                themes={['light', 'dark', 'system', 'blue', 'red', 'purple', 'green', 'pink']}
              >
                <NavigationGuardProvider>
                  <div className="flex flex-col h-screen">
                    <HeaderWithNav />
                    <main className="flex-1 py-4">{children}</main>
                  </div>
                  <Notifications />
                </NavigationGuardProvider>
              </ThemeProvider>
            </ErrorDialogProvider>
          </CompaniesProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
