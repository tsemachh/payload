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
      labelId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
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
        label: true
      },
      limit: companyIds.length,
      pagination: false 
    })

    const companiesMap = new Map(companies.docs.map(company => [company.id, company]))
    const bulkUpdates = []

    for (const companyId of companyIds) {
      try {
        const company = companiesMap.get(companyId)
        if (!company) {
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
        console.error(`Error processing company ${companyId}:`, err)
      }
    }

    const batchSize = 5
    const updateResults = []

    for (let i = 0; i < bulkUpdates.length; i += batchSize) {
      const batch = bulkUpdates.slice(i, i + batchSize)
      
      const updatePromises = batch.map(async ({ companyId, updatedLabels }) => {
        try {
          const updatedCompany = await req.payload.update({
            collection: 'companies',
            id: companyId,
            data: {
              label: { labels: updatedLabels },
            },
            depth: 0, // No population needed
          })
          return { success: true, companyId, updatedCompany }
        } catch (err) {
          return { success: false, companyId, error: (err as Error).message }
        }
      })

      const batchResults = await Promise.all(updatePromises)
      updateResults.push(...batchResults)
    }

    return Response.json({ results: updateResults, labelId })
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
        label: true
      },
      limit: companyIdsArray.length
    })

    // 🚀 Create results from batch query using Map for O(1) lookup
    const companiesMap = new Map(companies.docs.map(c => [c.id, c]))
    
    const results = companyIdsArray.map(companyId => ({
      companyId,
      labels: companiesMap.get(companyId)?.label?.labels || [],
    }))

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
    const allCompanyIds = [...new Set([...companyIds, ...prevCompIds])]

    // 🚀 Early exit if no companies to process
    if (allCompanyIds.length === 0) {
      return Response.json({ success: true, results: [], updatedCount: 0 })
    }

    // 1️⃣ Fetch all companies that might be affected - minimal fields only
    const companies = await req.payload.find({
      collection: 'companies',
      where: {
        id: { in: allCompanyIds }
      },
      select: {
        label: true // Get the whole label object
      },
      limit: allCompanyIds.length,
      pagination: false // Disable pagination for better performance
    })

    // 🚀 Early exit if no companies found
    if (!companies.docs || companies.docs.length === 0) {
      return Response.json({ success: true, results: [], updatedCount: 0 })
    }

    const companiesMap = new Map(companies.docs.map(company => [company.id, company]))
    const bulkUpdates = []

    // 2️⃣ Process each company and check for actual changes
    for (const companyId of allCompanyIds) {
      const company = companiesMap.get(companyId)
      if (!company) continue

      const existingLabels = company?.label?.labels || []
      let updatedLabels = [...existingLabels]
      let hasChanges = false


      // Find the existing label by the PREVIOUS values (not labelId!)
      const existingLabelIndex = updatedLabels.findIndex((lbl: any) => 
        lbl.label === prevLabel && lbl.color === prevColor
      )
      

      if (companyIds.includes(companyId)) {
        // Company should have this label
        const newLabelData = {
          labelId,
          label,
          color,
          stock: stocks,
          companiesWithSameLabel: companyIds,
        }

        if (existingLabelIndex !== -1) {
          // 🔥 UPDATE existing label (replace the old one with new values!)
          const existingLabel = updatedLabels[existingLabelIndex]
          
          
          // Replace the existing label completely with new data but keep the same labelId
          updatedLabels[existingLabelIndex] = {
            labelId: existingLabel.labelId, // Keep the original labelId
            label,
            color,
            stock: stocks,
            companiesWithSameLabel: companyIds,
          }
          hasChanges = true
        } else {
          // Add new label only if it doesn't exist
          updatedLabels.push(newLabelData)
          hasChanges = true
        }
      } else if (prevCompIds.includes(companyId)) {
        // Company should NOT have this label - remove it by PREVIOUS values
        const labelToRemoveIndex = updatedLabels.findIndex((lbl: any) => 
          lbl.label === prevLabel && lbl.color === prevColor
        )
        if (labelToRemoveIndex !== -1) {
          updatedLabels.splice(labelToRemoveIndex, 1)
          hasChanges = true
        }
      }

      // 3️⃣ Only update if there are actual changes
      if (hasChanges) {
        bulkUpdates.push({
          companyId,
          updatedLabels
        })
      }
    }

    // 🚀 Early exit if no updates needed
    if (bulkUpdates.length === 0) {
      return Response.json({ success: true, results: [], updatedCount: 0, message: 'No changes detected' })
    }

    // 4️⃣ Batch updates with smaller batches for better performance
    const batchSize = 5 // Smaller batches for faster individual updates
    const results = []

    for (let i = 0; i < bulkUpdates.length; i += batchSize) {
      const batch = bulkUpdates.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async ({ companyId, updatedLabels }) => {
        try {
          await req.payload.update({
            collection: 'companies',
            id: companyId,
            data: {
              label: { labels: updatedLabels },
            },
            depth: 0, // 🚀 No population needed
          })
          return { success: true, companyId }
        } catch (err) {
          console.error(`Failed to update company ${companyId}:`, err)
          return { success: false, companyId, error: (err as Error).message }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    console.log(`✅ Updated ${bulkUpdates.length} companies with tag changes in ${results.length} operations`)
    return Response.json({ success: true, results, updatedCount: bulkUpdates.length })
  } catch (error) {
    console.error('❌ Failed to update tag:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
