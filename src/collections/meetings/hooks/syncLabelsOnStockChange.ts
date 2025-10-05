import type { FieldHook } from 'payload'

export const syncLabelsOnStockChange: FieldHook = async ({ data, req, siblingData, operation }) => {
  const meetingId = req.routeParams?.id as string
  const userCompanies = req.user?.companies || []
  if (!data?.companies || data.companies.length === 0) {
    return
  }
  const userCompanyIds = userCompanies.map((c) => c.companyId)

  const filteredCompanies = data.companies.filter((companyId: any) =>
    userCompanyIds.includes(companyId),
  )

  if (filteredCompanies.length === 0) {
    return
  }
  const meetingStocks = Array.isArray(data.stock) ? data.stock : [data.stock]

  const updatedCompaniesLabels: {
    companyId: string
    labels: { label: string; color: string }[]
  }[] = []

  for (const companyId of filteredCompanies) {
    const company = await req.payload.findByID({
      collection: 'companies',
      id: companyId,
    })

    if (!company) {
      console.log(`Company not found: ${companyId}`)
      continue
    }

    const companyLabels = company.label?.labels || []

    const matchingLabels = companyLabels
      .filter((lbl: any) =>
        (lbl.stock || []).some((s: any) =>
          meetingStocks.includes(typeof s === 'string' ? s : s?.id || s?._id),
        ),
      )
      .map((lbl: any) => ({
        label: lbl.label,
        color: lbl.color,
      }))

    //console.log(`Matching labels for company ${companyId}:`, matchingLabels)

    updatedCompaniesLabels.push({
      companyId,
      labels: matchingLabels,
    })
  }

  const updatedLabels = Array.from(
    new Map(
      updatedCompaniesLabels.flatMap((c) =>
        c.labels.map((lbl) => [lbl.label + '|' + lbl.color, { ...lbl, id: null }]),
      ),
    ).values(),
  )

  console.log('Final updatedLabels to save in meeting:', req.routeParams?.id)

  await req.payload.update({
    collection: 'meetings',
    id: meetingId,
    data: { labels: updatedLabels },
  })

  //console.log('✅ Meeting labels updated successfully')
}
