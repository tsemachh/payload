import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../../app/styles/global.css'
import { ThemeProvider } from '@/components/theme-provider'
import { MainNav } from '@/components/main-nav'
import { Notifications } from '@/components/notifications'
import { ThemeChooser } from '@/components/theme-chooser'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          themes={['light', 'dark', 'system', 'blue', 'red', 'purple', 'green', 'pink']}
        >
          <div className="flex flex-col h-screen">
            <header className="border-b">
              <div className="flex h-16 items-center justify-between">
                <MainNav />
                <ThemeChooser />
              </div>
            </header>
            <main className="flex-1 py-6">{children}</main>
          </div>
          <Notifications />
        </ThemeProvider>
      </body>
    </html>
  )
}
