"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { useAuth } from "@/providers/auth-provider"

export default function RecoverPassword() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const { resetPassword } = useAuth()

  useEffect(() => {
    if (!token) {
      setError("חסר טוקן איפוס סיסמה. אנא בקש קישור איפוס חדש.")
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setError("הסיסמאות אינן תואמות")
      return
    }

    if (formData.password.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess(false)

    try {
      if (!token) {
        throw new Error("חסר טוקן איפוס סיסמה")
      }

      await resetPassword({
        token,
        password: formData.password,
      })

      setSuccess(true)

      // Redirect to login page after 3 seconds
      setTimeout(() => {
        router.push("/auth/signin")
      }, 3000)
    } catch (error) {
      setError(error instanceof Error ? error.message : "אירעה שגיאה באיפוס הסיסמה")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">איפוס סיסמה</CardTitle>
          <CardDescription className="text-center">
            הזן את הסיסמה החדשה שלך
          </CardDescription>
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
              <AlertDescription>
                הסיסמה שלך אופסה בהצלחה. מעביר אותך לדף ההתחברות...
              </AlertDescription>
            </Alert>
          )}

          {!success && !(!token && error) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה חדשה</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">אימות סיסמה</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || !token}>
                {isLoading ? "מאפס סיסמה..." : "אפס סיסמה"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/auth/signin" className="text-sm text-primary hover:underline">
            חזרה להתחברות
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
