'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast
            key={id}
            variant={variant}
            {...props}
            className={`
              rounded-lg shadow-xl p-4 flex items-start gap-4 min-w-[300px]
              ${
                variant === 'destructive'
                  ? 'bg-red-100 border-2 border-red-400 text-red-900 dark:bg-red-900/40 dark:border-red-500 dark:text-red-100'
                  : 'bg-green-100 border-2 border-green-400 text-green-900 dark:bg-green-900/40 dark:border-green-500 dark:text-green-100'
              }
            `}
          >
            <div className="grid gap-1 flex-1">
              {title && (
                <ToastTitle
                  className={`font-semibold text-sm ${
                    variant === 'destructive'
                      ? 'text-red-900 dark:text-red-100'
                      : 'text-green-900 dark:text-green-100'
                  }`}
                >
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription
                  className={`text-xs ${
                    variant === 'destructive'
                      ? 'text-red-800 dark:text-red-200'
                      : 'text-green-800 dark:text-green-200'
                  }`}
                >
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose
              className={`${
                variant === 'destructive'
                  ? 'text-red-600 hover:text-red-800'
                  : 'text-green-600 hover:text-green-800'
              }`}
            />
          </Toast>
        )
      })}
      <ToastViewport className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-[380px] max-w-full" />
    </ToastProvider>
  )
}
