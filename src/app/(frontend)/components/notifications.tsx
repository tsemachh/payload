"use client"

import { useEffect } from "react"
import { ToastProvider, ToastViewport } from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Notifications() {
  const { toast } = useToast()

  useEffect(() => {
    const eventSource = new EventSource("/api/sse")
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data)
      if (update.type === "newMeeting") {
        toast({
          title: "אסיפה חדשה",
          description: `נוספה אסיפה חדשה עבור ${update.data.company}.`,
        })
      }
    }

    return () => {
      eventSource.close()
    }
  }, [toast])

  return (
    <ToastProvider>
      <ToastViewport />
    </ToastProvider>
  )
}

