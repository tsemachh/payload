import React from 'react'

interface ErrorDisplayProps {
  message: string
  errors?: string[]
  className?: string
}

export function ErrorDisplay({ message, errors, className = '' }: ErrorDisplayProps) {
  return (
    <div className={`flex items-center justify-center min-h-[400px] ${className}`}>
      <div className="max-w-2xl w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-4">{message}</h2>
        {errors && errors.length > 0 && (
          <ul className="space-y-2">
            {errors.map((error, i) => (
              <li key={i} className="text-red-700 dark:text-red-300">
                {error}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
