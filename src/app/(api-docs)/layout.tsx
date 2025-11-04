import '../styles/global.css'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Documentation',
  description: 'API documentation for the Emda system',
}

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className="light" style={{ colorScheme: 'light' }}>
      <body className="bg-white min-h-screen">
        <main>{children}</main>
      </body>
    </html>
  )
}
