"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Dashboard() {
  const [stats, setStats] = useState({
    upcomingAssemblies: 0,
    participations: 0,
    holdings: 0,
  })

  useEffect(() => {
    // In a real application, you would fetch this data from your API
    setStats({
      upcomingAssemblies: 5,
      participations: 10,
      holdings: 20,
    })

    // Set up SSE for real-time updates
    const eventSource = new EventSource("/api/sse")
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data)
      if (update.type === "newMeeting") {
        setStats((prev) => ({
          ...prev,
          upcomingAssemblies: prev.upcomingAssemblies + 1,
        }))
      }
    }

    return () => {
      eventSource.close()
    }
  }, [])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Assemblies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.upcomingAssemblies}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Participations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.participations}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.holdings}</p>
        </CardContent>
      </Card>
    </div>
  )
}

