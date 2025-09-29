export const syncMeetingsOnCompanyChange = async ({ req, data }: any) => {
  try {
    const companyId = data.id
    const companyLabels = data?.label?.labels || []

    const companyStocksIds = companyLabels.flatMap((lbl: any) =>
      (lbl.stock || []).map((s: any) => (typeof s === 'string' ? s : s?.id || s?._id)),
    )
    const meetingsRes = await req.payload.find({
      collection: 'meetings',
      where: {
        companies: { contains: companyId },
        stock: {
          in: companyStocksIds,
        },
      },
      limit: 0,
    })
    const meetings = meetingsRes.docs || []
    for (const meeting of meetings) {
      try {
        const existingLabels = meeting.labels || []

        const updatedLabels = [...existingLabels]

        for (const companyLabel of companyLabels) {
          const idx = updatedLabels.findIndex((lbl: any) => lbl.label === companyLabel.label)

          if (idx > -1) {
            updatedLabels[idx].color = companyLabel.color
          } else {
            updatedLabels.push({
              label: companyLabel.label,
              color: companyLabel.color,
            })
          }
        }
        console.log('updatedLabels', updatedLabels)
        await req.payload.update({
          collection: 'meetings',
          id: meeting.id,
          data: { labels: updatedLabels },
        })
      } catch (err) {
        console.error(`❌ Failed to update meeting ${meeting.id}:`, err)
      }
    }
  } catch (err) {
    console.error('❌ syncMeetingsOnCompanyChange error:', err)
  }
}
