// Example component showing how to use the error dialog system
// This file is for documentation purposes and can be deleted

'use client'

import { Button } from '@/components/ui/button'
import { useErrorDialog } from '../context/error-dialog-context'
import { notifyError, handleAndNotifyError } from '../helpers/error-handler'

export function ExampleErrorUsage() {
  const { showError } = useErrorDialog()

  // Method 1: Using the global notifyError function (works from anywhere)
  const triggerGlobalError = () => {
    notifyError({
      message: 'זו הודעת שגיאה גלובלית שנקראת מפונקציית utility',
      code: 'GLOBAL_ERROR',
      details: { timestamp: new Date().toISOString() }
    })
  }

  // Method 2: Using the global function with detailed info
  const triggerDetailedError = () => {
    notifyError({
      message: 'שגיאה עם פרטים טכניים נוספים',
      code: 'DETAILED_ERROR',
      details: { 
        stack: 'Error stack trace here...',
        apiResponse: { status: 500, message: 'Internal server error' }
      }
    }, true) // true = show technical details
  }

  // Method 3: Using the context directly (only works within components)
  const triggerContextError = () => {
    showError({
      message: 'שגיאה שנקראה ישירות דרך הקונטקסט',
      code: 'CONTEXT_ERROR',
      details: { source: 'component' }
    })
  }

  // Method 4: Using the combined helper function
  const triggerCombinedError = () => {
    try {
      // Simulate an error
      throw new Error('Something went wrong in the API call')
    } catch (error) {
      handleAndNotifyError(error, 'שגיאה בביצוע הפעולה')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-bold">דוגמאות לשימוש במערכת השגיאות</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <Button onClick={triggerGlobalError} variant="destructive">
          שגיאה גלובלית
        </Button>
        
        <Button onClick={triggerDetailedError} variant="destructive">
          שגיאה עם פרטים
        </Button>
        
        <Button onClick={triggerContextError} variant="outline">
          שגיאה דרך קונטקסט
        </Button>
        
        <Button onClick={triggerCombinedError} variant="secondary">
          שגיאה משולבת
        </Button>
      </div>
    </div>
  )
}