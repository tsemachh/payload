import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../../app/global.css'
import { ThemeProvider } from '@/components/theme-provider'
import { MainNav } from '@/components/main-nav'
import { Notifications } from '@/components/notifications'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'מערכת ניהול אסיפות',
  description: 'מערכת מודרנית לניהול אסיפות',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex flex-col h-screen">
            <header className="border-b">
              <div className="container flex h-16 items-center justify-between">
                <MainNav />
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
