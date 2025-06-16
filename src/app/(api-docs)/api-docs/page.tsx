'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ApiDocsPage() {
  const [loading, setLoading] = useState(true)

  // Create a standalone HTML page for API docs
  useEffect(() => {
    // Once the component mounts, we're ready to show the iframe
    setLoading(false)
  }, [])

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">API Documentation</h1>
          <Link href="/" className="text-blue-500 hover:underline">
            ← Return to Main Site
          </Link>
        </div>
        <p className="text-gray-600 mt-2">Documentation for the Import Stocks API.</p>
      </header>

      {loading ? (
        <div className="flex justify-center items-center h-[600px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white border rounded-lg shadow-lg overflow-hidden">
          {/* Use iframe to completely isolate the API documentation */}
          <iframe
            src="/swagger-ui"
            className="w-full h-[700px] border-0"
            title="API Documentation"
          />
        </div>
      )}

      <footer className="mt-8 text-center text-gray-500 text-sm">
        <p>API documentation generated with Swagger UI</p>
      </footer>
    </div>
  )
}
