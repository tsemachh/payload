import payload from 'payload'
import fs from 'fs'
import path from 'path'

// New behavior (2025-11-29):
// - Read input exclusively from src/utils/stockMapping.json (array of { stockId, type, isin? })
// - Insert one document per JSON item into 'stock-migration-mapping'
//   * Always include stockId and type as-is from JSON
//   * If type === 'Foreign', require a valid ISIN (shape check). If missing/invalid → skip
//   * For non-Foreign, omit isin even if provided
// - De-duplication:
//   * First occurrence of a stockId wins (skip subsequent duplicates)
//   * For Foreign, also skip if the ISIN already appeared earlier
// - Preserve the two hard-coded extras (1082650, 1084003): insert if missing, otherwise update to enforce given ISINs

function looksLikeISIN(value?: string): boolean {
  if (!value) return false
  const v = value.trim().toUpperCase()
  // Basic ISIN shape check: 12 chars, starts with 2 letters
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v)
}

type MappingItem = {
  stockId: number
  type: 'Foreign' | 'Private' | 'NotActive' | 'NonTradable'
  isin?: string
}

function readJsonMapping(): MappingItem[] {
  const jsonPath = path.resolve(process.cwd(), 'src/utils/stockMapping.json')
  const raw = fs.readFileSync(jsonPath, 'utf8')
  const arr = JSON.parse(raw) as Array<any>
  if (!Array.isArray(arr)) return []
  return arr
    .map((o) => ({ stockId: o?.stockId, type: o?.type, isin: o?.isin }))
    .filter((o) => typeof o.stockId === 'number' && !!o.type)
}

export async function seedStockMigrationMapping() {
  try {
    // Drop existing data to avoid duplicates before inserting
    try {
      const deleted = await payload.delete({
        collection: 'stock-migration-mapping',
        where: { id: { exists: true } },
      })
      console.log(`Dropped ${deleted?.docs?.length ?? 0} existing stock-migration-mapping docs`)
    } catch (delErr) {
      console.warn(
        'Warning: failed to bulk-delete existing stock-migration-mapping docs (continuing):',
        delErr,
      )
    }
    const items = readJsonMapping()

    let createdCount = 0
    const createdIds = new Set<number>()

    const seenStockIds = new Set<number>()
    const seenIsins = new Set<string>()

    for (const item of items) {
      const stockId = item.stockId
      const type = item.type
      if (seenStockIds.has(stockId)) continue

      if (type === 'Foreign') {
        const isin = item.isin?.toString().trim().toUpperCase()
        if (!looksLikeISIN(isin)) continue
        if (seenIsins.has(isin!)) continue

        await payload.create({
          collection: 'stock-migration-mapping',
          data: { stockId, type: 'Foreign', isin },
        })
        seenIsins.add(isin!)
      } else if (type === 'Private' || type === 'NotActive' || type === 'NonTradable') {
        await payload.create({
          collection: 'stock-migration-mapping',
          data: { stockId, type },
        })
      } else {
        // Unknown type -> skip
        continue
      }

      createdCount++
      createdIds.add(stockId)
      seenStockIds.add(stockId)
    }

    // Add additional hard-coded values requested (only if not already created from CSV)
    const extraMappings: Array<{ stockId: number; type: 'Foreign'; isin: string }> = [
      { stockId: 1082650, type: 'Foreign', isin: 'IL0010826506' },
      { stockId: 1084003, type: 'Foreign', isin: 'IL0012007329' },
    ]

    for (const extra of extraMappings) {
      if (!createdIds.has(extra.stockId)) {
        await payload.create({
          collection: 'stock-migration-mapping',
          data: extra,
        })
        createdCount++
        createdIds.add(extra.stockId)
      } else {
        await payload.update({
          collection: 'stock-migration-mapping',
          data: extra,
          where: {
            stockId: { equals: extra.stockId },
          },
          context: { process: 'seedStockMigrationMapping' },
        })
      }
    }

    console.log(
      `Successfully seeded stock-migration-mapping collection from JSON. Inserted ${createdCount} docs.`,
    )
  } catch (error) {
    console.error('Error seeding stock-migration-mapping from JSON:', error)
    throw error
  }
}
