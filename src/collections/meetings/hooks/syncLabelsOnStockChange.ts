import type { CollectionBeforeChangeHook } from 'payload'

export const syncLabelsOnStockChange: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const newCompanies = data?.companies || []
  const oldCompanies = originalDoc?.companies || []

  const addedCompanies = newCompanies.filter((c: string) => !oldCompanies.includes(c))

  if (addedCompanies.length === 0) {
    //console.log('⚠️ No new companies added — skipping update.')
    return
  }

  const meetingStocks = Array.isArray(data.stock) ? data.stock : [data.stock]

  const updatedCompaniesLabels: { label: string; color: string }[] = []

  for (const companyId of addedCompanies) {
    try {
      const company = await req.payload.findByID({
        collection: 'companies',
        id: companyId,
      })

      if (!company) {
        console.warn(`⚠️ Company not found: ${companyId}`)
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

      updatedCompaniesLabels.push(...matchingLabels)
    } catch (err) {
      console.error(`💥 Error fetching company ${companyId}:`, err)
    }
  }

  const uniqueUpdatedLabels = Array.from(
    new Map(updatedCompaniesLabels.map((lbl) => [lbl.label + '|' + lbl.color, lbl])).values(),
  )

  //console.log('🧩 Final updatedLabels to save in meeting:', uniqueUpdatedLabels)

  data.labels = [...(data.labels || []), ...uniqueUpdatedLabels]

  //console.log('✅ data.labels set for saving:', data.labels)
}
