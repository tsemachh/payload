'use client'
import { useRouter } from 'next/navigation'

export default function CustomBeforeListButton(props: {
  children?: React.ReactNode
  description?: string
  message?: string
}) {
  const { children, description, message } = props
  const router = useRouter()

  const handleClick = () => {
    // Get today's date in the format expected by Payload (ISO 8601)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to midnight for date-only comparison
    const todayISO = today.toISOString()

    // Construct the where clause for meetingDate equals today
    const whereClause = {
      or: [
        {
          and: [
            {
              meetingDate: {
                equals: todayISO,
              },
            },
          ],
        },
      ],
    }

    // Encode the where clause for the URL
    const encodedWhere = encodeURIComponent(JSON.stringify(whereClause))

    // Base URL for the meetings collection (adjust as needed)
    const baseUrl = '/admin/collections/meetings'

    // Existing URL parameters (you can customize these based on your needs)
    const existingParams = new URLSearchParams({
      limit: '500',
      sort: 'participationReport',
      columns: JSON.stringify([
        '-magnaId',
        '-invitationLink',
        '-holdingsLimit',
        '-proxyVotingDate',
        'meetingDate',
      ]),
      page: '1',
    })

    // Append the where clause to the URL parameters
    existingParams.set('where', encodedWhere)

    // Construct the final URL
    const filterUrl = `${baseUrl}?${existingParams.toString()}`

    // Navigate to the filtered URL
    router.push(filterUrl)

    console.log('הכפתור נלחץ! Filtering to:', filterUrl)
  }

  return (
    <button onClick={handleClick} style={{ padding: '10px', fontSize: '16px' }}>
      {children || message || description || 'היום'}
    </button>
  )
}
