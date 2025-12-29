"use client"
import React from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
      <p className="text-sm text-gray-600 mb-4">
        The admin interface encountered an unexpected error. You can try again or return to the Admin home.
      </p>
      {process.env.NODE_ENV !== 'production' && error?.message ? (
        <pre className="text-left bg-gray-100 p-3 rounded border overflow-auto max-h-56 mb-4">
          {error.message}
        </pre>
      ) : null}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Try again
        </button>
        <Link
          href={{ pathname: '/admin' }}
          className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
          // Navigating without query params acts as a safe fallback
        >
          Back to Admin
        </Link>
      </div>
    </div>
  )
}
