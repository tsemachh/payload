'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface NavigationGuardDialogProps {
  navGuard: {
    active: boolean
    accept: () => void
    reject: () => void
  }
}

export default function NavigationGuardDialog({ navGuard }: NavigationGuardDialogProps) {
  return (
    <Dialog open={navGuard.active}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader className="flex flex-row items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 flex-shrink-0" />
          <DialogTitle className="text-xl text-amber-600 m-0">שינויים ישמרו כטיוטה</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p>טיוטה לא נשלחת למנהלי המערכת. אם ברצונך לשלוח את השינוים יש ללחוץ על שלח הצבעה</p>
        </div>

        <DialogFooter className="flex justify-center gap-3 mt-6">
          <Button variant="outline" onClick={navGuard.reject}>
            חזור לדף הצבעה
          </Button>
          <Button variant="destructive" onClick={navGuard.accept}>
            השאר כטיוטה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
