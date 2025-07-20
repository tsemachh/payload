"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Notification {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  route?: string
}

interface NotificationAlertProps {
  onOpenNotifications: () => void
  notifications: Notification[]
}

export function NotificationAlert({ onOpenNotifications, notifications }: NotificationAlertProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [showAlert, setShowAlert] = useState(false)
  const [hasShownAlert, setHasShownAlert] = useState(false)

  useEffect(() => {
    // Check if we've already shown the alert in this session
    const alertShown = sessionStorage.getItem("notification-alert-shown")
    if (alertShown) {
      setHasShownAlert(true)
      return
    }

    // Use the passed notifications to check for unread count
    const unreadNotifications = notifications.filter(n => !n.isRead)

    if (unreadNotifications.length > 0 && !hasShownAlert) {
      setUnreadCount(unreadNotifications.length)
      setShowAlert(true)
      // Mark that we've shown the alert for this session
      sessionStorage.setItem("notification-alert-shown", "true")
      setHasShownAlert(true)
    }
  }, [notifications, hasShownAlert])

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowAlert(false)
  }

  const handleAlertClick = () => {
    onOpenNotifications()
    setShowAlert(false)
  }

  if (!showAlert) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <Alert
        className="border-blue-200 bg-blue-50 text-blue-800 cursor-pointer hover:bg-blue-100 transition-colors max-w-lg w-full shadow-lg"
        onClick={handleAlertClick}
      >
        <Bell className="h-6 w-6" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-right flex-1 text-xl font-semibold">יש לך {unreadCount} התראות שלא נקראו</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 ml-3"
          >
            <X className="h-5 w-5" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
