import { MeetingsTablePastClient } from './ClientTable'

export function MeetingsTablePast() {
  const initialPageSize = 25

  return (
    <MeetingsTablePastClient
      initialPageSize={initialPageSize}
    />
  )
}
