import { PayloadRequest } from 'payload'

export const addTagToCompany = async (req: PayloadRequest) => {
  if (!req.json) {
    console.error('❌ req.json is undefined')
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const body = await req.json()
    let { companyIds, label, color, stocks: stock, labelId } = body
    
    // Generate labelId if not provided (for new tags)
    if (!labelId) {
      labelId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    if (!Array.isArray(companyIds) || companyIds.length === 0 || !label || !color || !stock) {
      return Response.json({ error: 'Missing fields' }, { status: 400 })
    }

    const companies = await req.payload.find({
      collection: 'companies',
      where: {
        id: { in: companyIds }
      },
      select: {
        id: true,
        label: true
      },
      limit: companyIds.length
    })

    const companiesMap = new Map(companies.docs.map(company => [company.id, company]))
    const results = []
    const bulkUpdates = []

    for (const companyId of companyIds) {
      try {
        const company = companiesMap.get(companyId)
        if (!company) {
          results.push({ success: false, companyId, error: 'Company not found' })
          continue
        }

        const existingLabels = company?.label?.labels || []
        
        // Check if label already exists
        const existingLabelIndex = existingLabels.findIndex((lbl: any) => lbl.labelId === labelId)
        
        let updatedLabels
        if (existingLabelIndex !== -1) {
          // Update existing label
          updatedLabels = [...existingLabels]
          updatedLabels[existingLabelIndex] = {
            ...existingLabels[existingLabelIndex],
            label,
            color,
            stock,
            companiesWithSameLabel: companyIds,
          }
        } else {
          // Add new label
          updatedLabels = [
            ...existingLabels,
            {
              labelId,
              label,
              color,
              stock,
              companiesWithSameLabel: companyIds,
            }
          ]
        }

        bulkUpdates.push({
          companyId,
          updatedLabels
        })

      } catch (err) {
        results.push({ success: false, companyId, error: (err as Error).message })
      }
    }

    const updatePromises = bulkUpdates.map(async ({ companyId, updatedLabels }) => {
      try {
        const updatedCompany = await req.payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            label: { labels: updatedLabels },
          },
        })
        return { success: true, companyId, updatedCompany }
      } catch (err) {
        return { success: false, companyId, error: (err as Error).message }
      }
    })

    const updateResults = await Promise.all(updatePromises)
    results.push(...updateResults)

    return Response.json({ results, labelId })
  } catch (error) {
    console.error('❌ addTagToCompany error:', error)
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

    const companies = await req.payload.find({
      collection: 'companies',
      where: {
        id: { in: companyIds }
      },
      select: {
        id: true,
        label: true
      },
      limit: companyIds.length
    })

    const companiesMap = new Map(companies.docs.map(company => [company.id, company]))
    const bulkUpdates = []

    // 🚀 Prepare all updates in memory first
    for (const companyId of companyIds) {
      const company = companiesMap.get(companyId)
      if (!company) continue

      const existingLabels = company?.label?.labels || []

      const updatedLabels = existingLabels.filter(
        (lbl: any) => !(lbl.label === tagLabel && lbl.color === tagColor),
      )

      bulkUpdates.push({
        companyId,
        updatedLabels
      })
    }

    const updatePromises = bulkUpdates.map(async ({ companyId, updatedLabels }) => {
      try {
        return await req.payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            label: { labels: updatedLabels },
          },
        })
      } catch (err) {
        console.error(`Failed to update company ${companyId}:`, err)
        return null
      }
    })

    // Wait for all updates to complete
    const results = await Promise.all(updatePromises)
    const successfulUpdates = results.filter(result => result !== null)

    return Response.json({ success: true, updated: successfulUpdates })
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

    const companyIdsArray = companyIds.map((companyObj: any) => companyObj.id)
    
    const companies = await req.payload.find({
      collection: 'companies',
      where: {
        id: { in: companyIdsArray }
      },
      select: {
        id: true,
        label: true
      },
      limit: companyIdsArray.length
    })

    // Create results from batch query
    const results = companyIdsArray.map(companyId => {
      const company = companies.docs.find(c => c.id === companyId)
      return {
        companyId,
        labels: company?.label?.labels || [],
      }
    })

    return Response.json({ results })
  } catch (err) {
    console.error('❌ getLabelsForCompanies error:', err)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
export const updateTagInCompany = async (req: PayloadRequest) => {
  if (typeof req.json !== 'function') {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const {
      companyIds,
      prevComp,
      prevStocks,
      prevColor,
      prevLabel,
      labelId,
      label,
      color,
      stocks,
    } = body
    if (
      !Array.isArray(companyIds) ||
      companyIds.length === 0 ||
      !Array.isArray(stocks) ||
      stocks.length === 0 ||
      !labelId ||
      !label ||
      !color
    ) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prevCompIds: string[] = prevComp || []

    const removedCompanyIds = prevCompIds.filter((id) => !companyIds.includes(id))
    const removeStockIds = prevStocks.filter((id: any) => !stocks.includes(id))
    if (removedCompanyIds.length && removeStockIds.length) {
      await deleteTagFromCompany({
        ...req,
        json: async () => ({
          companyIds: prevCompIds,
          stocks: removeStockIds,
          labelId,
          action: 'delete',
          tagLabel: prevLabel,
          tagColor: prevColor,
        }),
      } as any)
    } else {
      if (removedCompanyIds.length) {
        await deleteTagFromCompany({
          ...req,
          json: async () => ({
            companyIds: prevCompIds,
            stocks: prevStocks,
            labelId,
            action: 'delete',
            tagLabel: prevLabel,
            tagColor: prevColor,
          }),
        } as any)
      } else {
        if (removeStockIds.length) {
          await deleteTagFromCompany({
            ...req,
            json: async () => ({
              companyIds: prevCompIds,
              stocks: removeStockIds,
              labelId,
              action: 'delete',
              tagLabel: prevLabel,
              tagColor: prevColor,
            }),
          } as any)
        } else {
          await deleteTagFromCompany({
            ...req,
            json: async () => ({
              companyIds: prevCompIds,
              stocks: prevStocks,
              labelId,
              action: 'delete',
              tagLabel: prevLabel,
              tagColor: prevColor,
            }),
          } as any)
        }
      }
    }

    await addTagToCompany({
      ...req,
      json: async () => ({
        companyIds,
        label,
        color,
        stocks,
        labelId,
      }),
    } as any)

    return Response.json({ success: true })
  } catch (error) {
    console.error('❌ Failed to update tag:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
