'use client'

import { AlertTriangle, Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ErrorDetails } from '../helpers/error-handler'

export interface ErrorDialogProps {
  isOpen: boolean
  onCloseAction: () => void
  error: ErrorDetails | null
  showDetails?: boolean
}

export function ErrorDialog({
  isOpen,
  onCloseAction,
  error,
  showDetails = false,
}: ErrorDialogProps) {
  if (!error) return null

  const copyErrorDetails = () => {
    const errorText = `
שגיאה: ${error.message}
קוד שגיאה: ${error.code || 'לא זמין'}
זמן: ${new Date().toLocaleString('he-IL')}
URL: ${typeof window !== 'undefined' ? window.location.href : 'לא זמין'}
פרטים נוספים: ${JSON.stringify(error.details, null, 2)}
    `.trim()

    navigator.clipboard.writeText(errorText).then(() => {
      // Could add a small success indicator here
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-right justify-end flex-row-reverse">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span>שגיאת מערכת</span>
          </DialogTitle>
          <DialogDescription className="text-right">
            אירעה שגיאה בביצוע הפעולה. פרטים נוספים:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main error message */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p
              className="text-sm font-medium text-destructive text-right"
              style={{ width: '400px' }}
            >
              {error.message}
            </p>
          </div>

          {/* Error code badge */}
          {error.code && (
            <div className="flex justify-end">
              <Badge variant="outline" className="text-xs">
                קוד שגיאה: {error.code}
              </Badge>
            </div>
          )}

          {/* Detailed error information - collapsible */}
          {showDetails && error.details && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-right">פרטים טכניים:</h4>
              <ScrollArea className="max-h-[200px] rounded border bg-muted p-3">
                <pre className="text-xs text-right whitespace-pre-wrap font-mono">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}

          {/* Helpful suggestions */}
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="text-sm font-medium mb-2 text-right">פעולות מומלצות:</h4>
            <ul className="text-xs space-y-1 text-right">
              <li>• נסה לרענן את הדף ולבצע את הפעולה שוב</li>
              <li>• בדוק את חיבור האינטרנט שלך</li>
              <li>• אם הבעיה נמשכת, צור קשר עם התמיכה הטכנית</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={copyErrorDetails} className="gap-2">
            <Copy className="h-4 w-4" />
            העתק פרטים
          </Button>
          <Button onClick={onCloseAction} size="sm" className="gap-2">
            <X className="h-4 w-4" />
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
