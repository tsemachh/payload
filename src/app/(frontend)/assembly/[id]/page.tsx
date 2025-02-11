'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

// Mock data - in a real app this would come from your API
const mockMeeting = {
  id: 1,
  company: 'חברה א',
  date: '2025-02-15',
  type: 'שנתית',
  status: 'קרובה',
  description: 'אסיפה כללית שנתית של חברה א',
  topics: [
    {
      id: 1,
      title: 'אישור דוחות כספיים',
      description: 'אישור הדוחות הכספיים של החברה לשנת 2024',
      recommendation: 'בעד',
    },
    {
      id: 2,
      title: 'מינוי דירקטורים',
      description: 'מינוי מחדש של חברי הדירקטוריון',
      recommendation: 'בעד',
    },
    {
      id: 3,
      title: 'מינוי רואה חשבון מבקר',
      description: 'מינוי מחדש של משרד רואי החשבון המבקר',
      recommendation: 'בעד',
    },
  ],
  documents: [
    { id: 1, name: 'זימון אסיפה', type: 'pdf' },
    { id: 2, name: 'דוחות כספיים', type: 'pdf' },
    { id: 3, name: 'כתב הצבעה', type: 'pdf' },
  ],
}

export default function MeetingDetail() {
  // const params = useParams()
  const router = useRouter()
  const [votes, setVotes] = useState<Record<number, string>>({})
  const [comments, setComments] = useState<Record<number, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleVoteSubmit = async () => {
    setIsSubmitting(true)
    // In a real app, you would submit to your API here
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSubmitting(false)
    router.push('/participations')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">אסיפת {mockMeeting.company}</CardTitle>
          <CardDescription>
            {mockMeeting.type} -{' '}
            {format(new Date(mockMeeting.date), 'dd MMMM yyyy', { locale: he })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>{mockMeeting.description}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="voting" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="voting">הצבעה</TabsTrigger>
          <TabsTrigger value="documents">מסמכים</TabsTrigger>
        </TabsList>

        <TabsContent value="voting" className="space-y-4">
          {mockMeeting.topics.map((topic) => (
            <Card key={topic.id}>
              <CardHeader>
                <CardTitle>{topic.title}</CardTitle>
                <CardDescription>{topic.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>המלצת הצבעה: {topic.recommendation}</Label>
                  <RadioGroup
                    value={votes[topic.id]}
                    onValueChange={(value) => setVotes((prev) => ({ ...prev, [topic.id]: value }))}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="בעד" id={`for-${topic.id}`} />
                      <Label htmlFor={`for-${topic.id}`}>בעד</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="נגד" id={`against-${topic.id}`} />
                      <Label htmlFor={`against-${topic.id}`}>נגד</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="נמנע" id={`abstain-${topic.id}`} />
                      <Label htmlFor={`abstain-${topic.id}`}>נמנע</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>הערות</Label>
                  <Textarea
                    value={comments[topic.id] || ''}
                    onChange={(e) =>
                      setComments((prev) => ({ ...prev, [topic.id]: e.target.value }))
                    }
                    placeholder="הוסף הערות להצבעה..."
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full">שלח הצבעה</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>אישור הצבעה</DialogTitle>
                <DialogDescription>
                  האם אתה בטוח שברצונך לשלוח את ההצבעה? לא ניתן לשנות את ההצבעה לאחר השליחה.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleVoteSubmit()}
                  disabled={isSubmitting}
                >
                  ביטול
                </Button>
                <Button onClick={() => handleVoteSubmit()} disabled={isSubmitting}>
                  {isSubmitting ? 'שולח...' : 'אישור'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {mockMeeting.documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle className="text-base">{doc.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  הורד מסמך
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
