"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import LogoImage from "@/graphics/Logo/emda_logo.png"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { useAuth } from "@/providers/auth-provider"

// Client component that uses useSearchParams
function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      await login({
        email: formData.email,
        password: formData.password,
      })

      router.push(callbackUrl)
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : "פרטי התחברות שגויים")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Image 
              src={LogoImage} 
              alt="Emda Logo" 
              width={150} 
              height={150} 
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">התחברות</CardTitle>
          <CardDescription className="text-center">
            הזן את פרטי ההתחברות שלך כדי להיכנס למערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">סיסמה</Label>
                <Link 
                  href="/auth/reset-password" 
                  className="text-sm text-primary hover:underline"
                >
                  שכחת סיסמה?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "מתחבר..." : "התחבר"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            אין לך חשבון? צור קשר עם מנהל המערכת
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

// Main component that wraps the content in a Suspense boundary
export default function SignIn() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}
