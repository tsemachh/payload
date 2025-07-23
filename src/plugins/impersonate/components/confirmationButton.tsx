'use client'

import { useState } from 'react'
import { UserCheck } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { getLabels, SupportedLocale } from '../labels'
import { useLocale } from '../hooks/useLocale'

interface ConfirmationButtonProps {
  url: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  openInNewTab?: boolean
  userName?: string
}

export default function ConfirmationButton({
  url,
  variant = 'outline',
  size = 'sm',
  openInNewTab = false,
  userName,
}: ConfirmationButtonProps) {
  const [open, setOpen] = useState(false)
  const locale = useLocale()
  const labels = getLabels(locale as SupportedLocale)

  const handleConfirm = () => {
    if (openInNewTab) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      window.location.href = url
    }
    setOpen(false)
  }

  const finalDescription = userName
    ? labels.confirmationDescriptionWithUser.replace('{userName}', userName)
    : labels.confirmationDescription

  // Determine text direction based on locale
  const isRTL = locale === 'he'
  const directionClass = isRTL ? 'rtl' : 'ltr'
  const textAlignClass = isRTL ? 'text-right' : 'text-left'

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5 cursor-pointer">
          <UserCheck className="h-3.5 w-3.5" />
          {labels.impersonate}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className={`${directionClass}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <AlertDialogHeader className={textAlignClass}>
          <AlertDialogTitle className={textAlignClass}>{labels.confirmationTitle}</AlertDialogTitle>
          <AlertDialogDescription className={textAlignClass}>
            {finalDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
          <AlertDialogCancel className="cursor-pointer">{labels.cancelButton}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="cursor-pointer">
            {labels.confirmButton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
