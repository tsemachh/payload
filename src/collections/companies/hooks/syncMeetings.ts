export const syncMeetingsOnCompanyChange = async ({ req, data, previousDoc }: any) => {
  try {
    const prevLabels = previousDoc?.label?.labels || []
    const newLabels = data?.label?.labels || []

    const addedLabels = newLabels.filter(
      (curr: any) =>
        !prevLabels.some((prev: any) => prev.label === curr.label && prev.color === curr.color),
    )
    const removedLabels = prevLabels.filter(
      (prev: any) =>
        !newLabels.some((curr: any) => curr.label === prev.label && curr.color === prev.color),
    )

    for (const companyLabel of addedLabels) {
      const stockIds = (companyLabel.stock || []).map((s: any) =>
        typeof s === 'string' ? s : s?.id || s?._id,
      )
      const labelCompanyIds = (companyLabel.companiesWithSameLabel || []).map((c: any) =>
        typeof c === 'string' ? c : c?.id || c?._id,
      )

      const meetingsRes = await req.payload.find({
        collection: 'meetings',
        where: {
          companies: { in: labelCompanyIds },
          stock: { in: stockIds },
        },
        limit: 0,
      })

      for (const meeting of meetingsRes.docs) {
        const existingLabels = meeting.labels || []
        const updatedLabels = existingLabels.filter((lbl: any) => lbl.label !== companyLabel.label)

        updatedLabels.push({
          label: companyLabel.label,
          color: companyLabel.color,
          stock: stockIds,
          companiesWithSameLabel: labelCompanyIds,
        })

        await req.payload.update({
          collection: 'meetings',
          id: meeting.id,
          data: { labels: updatedLabels },
          req: {
            ...req,
            context: { ...req.context, process: 'syncMeetingLabelsOnCompanyLabelAdd' },
          },
        })
      }
    }

    for (const companyLabel of removedLabels) {
      const meetingsRes = await req.payload.find({
        collection: 'meetings',
        where: {
          'labels.label': { equals: companyLabel.label },
          'labels.color': { equals: companyLabel.color },
        },
        limit: 0,
      })

      for (const meeting of meetingsRes.docs) {
        const existingLabels = meeting.labels || []
        const updatedLabels = existingLabels.filter(
          (lbl: any) => !(lbl.label === companyLabel.label && lbl.color === companyLabel.color),
        )

        await req.payload.update({
          collection: 'meetings',
          id: meeting.id,
          data: { labels: updatedLabels },
          req: {
            ...req,
            context: { ...req.context, process: 'syncMeetingLabelsOnCompanyLabelRemove' },
          },
        })
      }
    }
  } catch (err) {
    console.error('❌ syncMeetingsOnCompanyChange error:', err)
  }
}
