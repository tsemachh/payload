export const syncMeetingsOnCompanyChange = async ({ req, data, previousDoc }: any) => {
  try {
    const prevLabels = previousDoc?.label?.labels || []
    const newLabels = data?.label?.labels || []
    const normalizeIds = (arr: any[] = []) =>
      arr.map((v) => (typeof v === 'string' ? v : v?.id || v?._id)).filter(Boolean)

    const arraysEqual = (a: any[] = [], b: any[] = []) => {
      if (a.length !== b.length) return false
      const sa = normalizeIds(a).sort()
      const sb = normalizeIds(b).sort()
      return sa.every((v, i) => v === sb[i])
    }
    
    const addedLabels = newLabels.filter((curr: any) => {
      const prev = prevLabels.find((p: any) => p.label === curr.label && p.color === curr.color)

      if (!prev) return true

      return !arraysEqual(prev.stock || [], curr.stock || [])
    })
    const removedLabels = prevLabels
      .map((prev:any) => {
        const curr = newLabels.find((c:any) => c.label === prev.label && c.color === prev.color)
        if (!curr) return prev 

        const prevStock = normalizeIds(prev.stock)
        const currStock = normalizeIds(curr.stock)

        const removedStock = prevStock.filter((id) => !currStock.includes(id))
        if (removedStock.length === 0) return null 

        return {
          ...prev,
          stock: removedStock,
        }
      })
      .filter(Boolean)
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
      const currentLabel = newLabels.find(
        (lbl: any) => lbl.label === companyLabel.label && lbl.color === companyLabel.color,
      )

      if (currentLabel) {
        const currentStockIds = (currentLabel.stock || []).map((s: any) =>
          typeof s === 'string' ? s : s?.id || s?._id,
        )
        const labelCompanyIds = (currentLabel.companiesWithSameLabel || []).map((c: any) =>
          typeof c === 'string' ? c : c?.id || c?._id,
        )

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

          const meetingStocks = Array.isArray(meeting.stock) ? meeting.stock : [meeting.stock]
          const meetingStockIds = meetingStocks.map((s:any) =>
            typeof s === 'string' ? s : s?.id || s?._id,
          )

          const hasRelevantStock = currentStockIds.some((stockId:any) =>
            meetingStockIds.includes(stockId),
          )

          if (hasRelevantStock) {
            const updatedLabels = existingLabels.map((lbl: any) => {
              if (lbl.label === companyLabel.label && lbl.color === companyLabel.color) {
                return {
                  ...lbl,
                  stock: currentStockIds,
                  companiesWithSameLabel: labelCompanyIds,
                }
              }
              return lbl
            })

            await req.payload.update({
              collection: 'meetings',
              id: meeting.id,
              data: { labels: updatedLabels },
              req: {
                ...req,
                context: { ...req.context, process: 'syncMeetingLabelsOnCompanyLabelUpdate' },
              },
            })
          } else {
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
      } else {
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
    }
  } catch (err) {
    console.error('❌ syncMeetingsOnCompanyChange error:', err)
  }
}
