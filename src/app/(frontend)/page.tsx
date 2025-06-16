import { MeetingsTableClient } from './meetings/ClientTable'

export default function MeetingsPage() {
  return (
    <div className="space-y-4 flex flex-col">
      <MeetingsTableClient />
    </div>
  )
}
