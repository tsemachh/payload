import { PayloadRequest } from 'payload'

export const addTagToCompany = async (req: PayloadRequest) => {
  if (!req.json) {
    console.error('❌ req.json is undefined')
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { companyIds, label, color, stocks: stock } = body
    if (!Array.isArray(companyIds) || companyIds.length === 0 || !label || !color || !stock) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const results = []

    for (const companyId of companyIds) {
      try {
        const company = await req.payload.findByID({
          collection: 'companies',
          id: companyId,
        })

        const existingLabels = company?.label?.labels || []

        const companiesWithSameLabel = companyIds

        const updatedLabels = [...existingLabels, { label, color, stock, companiesWithSameLabel }]

        const updatedCompany = await req.payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            label: {
              labels: updatedLabels,
            },
          },
        })

        results.push({ success: true, companyId, updatedCompany })
      } catch (err) {
        console.error(`❌ Failed to update company ${companyId}:`, err)
        results.push({ success: false, companyId, error: (err as Error).message })
      }
    }

    return Response.json({ results })
  } catch (error) {
    console.error('❌ Failed to add tag:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export const deleteTagFromCompany = async (req: PayloadRequest) => {
  if (typeof req.json !== 'function') {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const body = await req.json()

    if (body.action !== 'delete') {
      return Response.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { companyIds, tagColor, tagLabel, labelId } = body
    if (!companyIds || !Array.isArray(companyIds) || !labelId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const results = []

    for (const companyId of companyIds) {
      const company = await req.payload.findByID({
        collection: 'companies',
        id: companyId,
      })

      const existingLabels = company?.label?.labels || []

      const updatedLabels = existingLabels.filter(
        (lbl: any) => !(lbl.label === tagLabel && lbl.color === tagColor),
      )

      const updatedCompany = await req.payload.update({
        collection: 'companies',
        id: companyId,
        data: {
          label: {
            labels: updatedLabels,
          },
        },
      })
      console.log('✅ Updated company:', updatedCompany?.id)

      results.push(updatedCompany)
    }

    return Response.json({ success: true, updated: results })
  } catch (error) {
    console.error('❌ Failed to delete tag:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export const getLabelsForCompanies = async (req: PayloadRequest) => {
  try {
    if (!req.json) {
      console.error('❌ req.json is undefined')
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const body = await req.json()
    const { companyIds } = body

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return Response.json({ error: 'Missing companyIds' }, { status: 400 })
    }

    const results = []
    for (const companyObj of companyIds) {
      const id = companyObj.id
      const company = await req.payload.findByID({
        collection: 'companies',
        id,
      })

      results.push({
        companyId: id,
        labels: company?.label?.labels || [],
      })
    }

    return Response.json({ results })
  } catch (err) {
    console.error('❌ getLabelsForCompanies error:', err)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
