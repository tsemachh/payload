"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"

export default function Logout() {
  const router = useRouter()
  const { logout } = useAuth()

  useEffect(() => {
    const performLogout = async () => {
      await logout()
      router.push("/auth/signin")
    }

    performLogout()
  }, [router, logout])

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">התנתקות</CardTitle>
          <CardDescription className="text-center">
            מתנתק מהמערכת...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    </div>
  )
}
