'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import moment from 'moment'
import 'moment/locale/he'

interface Notification {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  route?: string
}

export function UserNotificationComponent() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Fetch notifications on component mount
  useEffect(() => {
    fetchNotifications()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/company-meeting-notifications/user-notifications')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(
        `/api/company-meeting-notifications/mark-read/${notificationId}`,
        {
          method: 'POST',
        },
      )

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
        )
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      setMarkingAllAsRead(true)
      const response = await fetch('/api/company-meeting-notifications/mark-all-read', {
        method: 'POST',
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    } finally {
      setMarkingAllAsRead(false)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }

    if (notification.route) {
      router.push(notification.route)
    }

    setIsOpen(false)
  }

  const formatDate = (dateString: string) => {
    // Set locale to Hebrew
    moment.locale('he')
    // Use moment.js relative time formatting
    return moment(dateString).fromNow()
  }

  return (
    <TooltipProvider>
      <div className="relative" ref={dropdownRef}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setIsOpen(!isOpen)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{unreadCount > 0 ? `יש לך ${unreadCount} התראות שלא נקראו` : 'אין התראות חדשות'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Notification Dropdown */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-2 w-[39rem] bg-background border rounded-lg shadow-lg z-50">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg text-left">התראות</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    disabled={markingAllAsRead}
                    className="text-xs"
                  >
                    <CheckCheck className="h-3 w-3 ml-1" />
                    {markingAllAsRead ? 'מסמן...' : 'סמן הכל כנקרא'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-[70vh]">
              {loading ? (
                <div className="p-4 text-right text-muted-foreground">טוען התראות...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-right text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין התראות להציג</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 cursor-pointer transition-colors hover:bg-muted/50',
                        !notification.isRead && 'bg-blue-50/50 border-r-2 border-r-blue-500',
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center gap-2 mb-1 justify-end">
                            {!notification.isRead && (
                              <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              ({formatDate(notification.createdAt)})
                            </span>
                            <h4
                              className={cn(
                                'text-sm font-medium truncate',
                                !notification.isRead && 'font-semibold',
                              )}
                            >
                              {notification.title}
                            </h4>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2 text-right">
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
