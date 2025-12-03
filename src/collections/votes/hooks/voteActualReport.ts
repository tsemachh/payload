import { FieldHook } from 'payload'

export const handleReportApproval: FieldHook = async ({ data, operation, req }) => {
  if ((operation === 'update' || operation === 'create') && data?.reportApproval) {
    try {
      const notifications = await req.payload.find({
        collection: 'admin-notifications',
        where: {
          companies: { equals: data.company },
          meeting: { equals: data.meeting },
        },
        limit: 0,
      })

      await Promise.all(
        notifications.docs.map((notification: any) =>
          req.payload.update({
            collection: 'admin-notifications',
            id: notification.id,
            data: { handled: true },
          }),
        ),
      )
    } catch (err) {
      console.error('Error fetching/updating admin notifications:', err)
    }
  }

  return data
}
