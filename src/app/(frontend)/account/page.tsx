'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, User } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/providers/auth-provider'
import { TwoFactorManager } from '@/components/TwoFactorManager'

export default function AccountPage() {
  const { user } = useAuth()
  const [userData, setUserData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    receiveMailNotification: true,
  })

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          setUserData(user)
          setFormData({
            ...formData,
            name: user.name || '',
            email: user.email || '',
            receiveMailNotification:
              user.receiveMailNotification !== undefined
                ? (user.receiveMailNotification as boolean)
                : true,
          })
        } catch (error) {
          console.error('Error setting user data:', error)
          setError('Failed to load user data')
        } finally {
          setIsFetching(false)
        }
      } else if (user === null) {
        // User is not authenticated
        setIsFetching(false)
      }
    }

    fetchUserData()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess(false)

    // Validate passwords if trying to change password
    if (formData.newPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        setError('הסיסמאות החדשות אינן תואמות')
        setIsLoading(false)
        return
      }

      if (formData.newPassword.length < 8) {
        setError('הסיסמה החדשה חייבת להכיל לפחות 8 תווים')
        setIsLoading(false)
        return
      }

      if (!formData.currentPassword) {
        setError('יש להזין את הסיסמה הנוכחית')
        setIsLoading(false)
        return
      }
    }

    try {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      // Prepare update data
      const updateData: any = {
        name: formData.name,
        receiveMailNotification: formData.receiveMailNotification,
      }

      // Add password update if provided
      if (formData.newPassword && formData.currentPassword) {
        updateData.password = formData.newPassword
        updateData.currentPassword = formData.currentPassword
      }

      // Update user in Payload CMS
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updateData),
        cache: 'no-store',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update profile')
      }

      // Clear password fields
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      setSuccess(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  if (user === undefined || isFetching) {
    return (
      <div className="container max-w-4xl py-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center space-x-4 space-x-reverse">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{formData.name?.charAt(0) || <User />}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl font-bold">הפרופיל שלי</CardTitle>
              <CardDescription>צפה ועדכן את פרטי החשבון שלך</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>הפרופיל עודכן בהצלחה</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" type="email" value={formData.email} disabled={true} />
              <p className="text-sm text-muted-foreground">לא ניתן לשנות את כתובת האימייל</p>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse mt-4">
              <Checkbox
                id="receiveMailNotification"
                checked={formData.receiveMailNotification}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, receiveMailNotification: checked as boolean })
                }
                disabled={isLoading}
              />
              <Label
                htmlFor="receiveMailNotification"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                קבלת התראות במייל
              </Label>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-lg font-medium mb-4">שינוי סיסמה</h3>

              <div className="space-y-2">
                <Label htmlFor="currentPassword">סיסמה נוכחית</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currentPassword: e.target.value,
                    })
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="newPassword">סיסמה חדשה</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="confirmPassword">אימות סיסמה חדשה</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button type="submit" className="mt-4" disabled={isLoading}>
              {isLoading ? 'שומר שינויים...' : 'שמור שינויים'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4">
          <Button variant="outline" asChild>
            <Link href="/">חזרה לדף הבית</Link>
          </Button>
          <Button variant="outline" asChild className="text-red-500 hover:text-red-700">
            <Link href="/auth/logout">התנתק</Link>
          </Button>
        </CardFooter>
      </Card>
      
      {/* 2FA Management Section */}
      <TwoFactorManager />
    </div>
  )
}
