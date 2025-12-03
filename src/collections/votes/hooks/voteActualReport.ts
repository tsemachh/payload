import { FieldHook } from 'payload'

export const handleReportApproval: FieldHook = async ({ data, operation, req }) => {
  if ((operation === 'update' || operation === 'create') && data?.reportApproval) {
    try {
      await req.payload.update({
        collection: 'admin-notifications',
        where: {
          companies: { equals: data.company },
          meeting: { equals: data.meeting },
        },
        data: { handled: true },
      })
    } catch (err) {
      console.error('Error updating admin notifications:', err)
    }
  }

  return data
}
