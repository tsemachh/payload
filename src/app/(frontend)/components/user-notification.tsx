'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NotificationAlert } from '@/components/notification-alert'
import moment from 'moment'
import { ScrollArea } from '@radix-ui/react-scroll-area'

interface Notification {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  route?: string
}

interface GroupedNotification extends Notification {
  count: number
  notificationIds: string[]
}

export const UserNotificationComponent = forwardRef<{ openNotifications: () => void }>(
  (props, ref) => {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [markingAllAsRead, setMarkingAllAsRead] = useState(false)
    const [showUnreadOnly, setShowUnreadOnly] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    // Group notifications by message on the client side
    const groupNotificationsByMessage = (notifications: Notification[]): GroupedNotification[] => {
      const groups = new Map<string, Notification[]>()

      notifications.forEach((notification) => {
        const key = notification.message
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(notification)
      })

      return Array.from(groups.entries())
        .map(([message, groupedNotifications]) => {
          // Use the most recent notification for main properties
          const latestNotification = groupedNotifications.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0]

          // Check if all notifications in the group are read
          const allRead = groupedNotifications.every((n) => n.isRead)

          return {
            ...latestNotification,
            isRead: allRead,
            count: groupedNotifications.length,
            notificationIds: groupedNotifications.map((n) => n.id),
          }
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    const groupedNotifications = groupNotificationsByMessage(notifications)
    const unreadCount = groupedNotifications.filter((n) => !n.isRead).length
    const filteredNotifications = showUnreadOnly
      ? groupedNotifications.filter((n) => !n.isRead)
      : groupedNotifications

    useImperativeHandle(ref, () => ({
      openNotifications: () => {
        setIsOpen(true)
      },
    }))

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

    const markAsRead = async (groupedNotification: GroupedNotification) => {
      try {
        // Mark all notifications in the group as read
        const markPromises = groupedNotification.notificationIds.map((id) =>
          fetch(`/api/company-meeting-notifications/mark-read/${id}`, {
            method: 'POST',
          }),
        )

        const responses = await Promise.all(markPromises)

        if (responses.every((response) => response.ok)) {
          // Update the local state to mark all notifications in the group as read
          setNotifications((prev) =>
            prev.map((n) =>
              groupedNotification.notificationIds.includes(n.id) ? { ...n, isRead: true } : n,
            ),
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

    const handleNotificationClick = async (notification: GroupedNotification) => {
      if (!notification.isRead) {
        await markAsRead(notification)
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

    const handleOpenNotifications = () => {
      setIsOpen(true)
    }
    return (
      <>
        <NotificationAlert
          onOpenNotifications={handleOpenNotifications}
          notifications={notifications}
        />
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
                <p>
                  {unreadCount > 0 ? `יש לך ${unreadCount} התראות שלא נקראו` : 'אין התראות חדשות'}
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Notification Dropdown */}
            {isOpen && (
              <div className="absolute left-0 top-full mt-2 w-[39rem] bg-background border rounded-lg shadow-lg z-50">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold text-lg text-left">התראות</h3>
                  <div className="flex items-center space-x-3 space-x-reverse justify-start">
                    <Checkbox
                      id="unread-filter"
                      checked={showUnreadOnly}
                      onCheckedChange={(checked) => setShowUnreadOnly(checked === true)}
                    />
                    <label
                      htmlFor="unread-filter"
                      className="text-sm font-medium cursor-pointer mr-4"
                    >
                      הצג לא נקראו
                    </label>
                  </div>
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

                <ScrollArea className="max-h-[70vh] overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-right text-muted-foreground">טוען התראות...</div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="p-8 text-right text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{showUnreadOnly ? 'כל ההתראות נקראו' : 'אין התראות להציג'}</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            'p-4 cursor-pointer transition-colors hover:bg-muted/50',
                            !notification.isRead && 'bg-blue-50/50 border-r-2 border-r-blue-500',
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start justify-end gap-3">
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
      </>
    )
  },
)
