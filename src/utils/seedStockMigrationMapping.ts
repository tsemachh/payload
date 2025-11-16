import payload from 'payload'
import fs from 'fs'
import path from 'path'

// We align the seed according to the CSV rules:
// 1. Private: שיוך === "חברה פרטית"
// 2. NotActive: שיוך === "לא רלוונטי יותר"
// 3. NonTradable: שיוך === "לא סחיר"
// 4. Foreign: שיוך is anything else (including ISIN codes, "סחיר", empty, etc.)
//    - If שיוך looks like an ISIN (12 characters, CC prefix), we store it in the "isin" field.

function looksLikeISIN(value?: string): boolean {
  if (!value) return false
  const v = value.trim().toUpperCase()
  // Basic ISIN shape check: 12 chars, starts with 2 letters
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v)
}

function readCsvRows(): string[][] {
  const csvPath = path.resolve(process.cwd(), 'src/utils/stockMigrationMapping.csv')
  const content = fs.readFileSync(csvPath, 'utf8')
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return []

  // Robust line parser that respects quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  const header = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)

  // Find indices dynamically by header names
  const stockIdIdx = header.findIndex((h) => h.trim() === 'stockId')
  const assocIdx = header.findIndex((h) => h.trim() === 'שיוך')

  if (stockIdIdx === -1 || assocIdx === -1) {
    throw new Error('CSV is missing required columns: stockId and/or שיוך')
  }

  // Return rows filtered to those having a stockId
  return rows.filter((cols) => {
    const idStr = cols[stockIdIdx]?.trim()
    return idStr && !Number.isNaN(Number(idStr))
  }).map((cols) => cols)
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
      console.warn('Warning: failed to bulk-delete existing stock-migration-mapping docs (continuing):', delErr)
    }
    const rows = readCsvRows()

    // Re-parse header to get indices
    const csvPath = path.resolve(process.cwd(), 'src/utils/stockMigrationMapping.csv')
    const content = fs.readFileSync(csvPath, 'utf8')
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0)

    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(current)
          current = ''
        } else {
          current += ch
        }
      }
      result.push(current)
      return result
    }

    const header = parseLine(lines[0])
    const stockIdIdx = header.findIndex((h) => h.trim() === 'stockId')
    const assocIdx = header.findIndex((h) => h.trim() === 'שיוך')

    const HEB_PRIVATE = 'חברה פרטית'
    const HEB_NOT_ACTIVE = 'לא רלוונטי יותר'
    const HEB_NON_TRADABLE = 'לא סחיר'

    let createdCount = 0
    const createdIds = new Set<number>()

    for (const cols of rows) {
      const stockIdStr = cols[stockIdIdx]?.trim()
      const assocRaw = cols[assocIdx]?.trim()
      const stockId = Number(stockIdStr)
      if (!stockIdStr || Number.isNaN(stockId)) continue

      if (assocRaw === HEB_PRIVATE) {
        await payload.create({
          collection: 'stock-migration-mapping',
          data: { stockId, type: 'Private' },
        })
        createdCount++
        createdIds.add(stockId)
        continue
      }

      if (assocRaw === HEB_NOT_ACTIVE) {
        await payload.create({
          collection: 'stock-migration-mapping',
          data: { stockId, type: 'NotActive' },
        })
        createdCount++
        createdIds.add(stockId)
        continue
      }

      if (assocRaw === HEB_NON_TRADABLE) {
        await payload.create({
          collection: 'stock-migration-mapping',
          data: { stockId, type: 'NonTradable' },
        })
        createdCount++
        createdIds.add(stockId)
        continue
      }

      // Otherwise treat as Foreign
      const isin = looksLikeISIN(assocRaw) ? assocRaw.trim().toUpperCase() : undefined
      await payload.create({
        collection: 'stock-migration-mapping',
        data: {
          stockId,
          type: 'Foreign',
          ...(isin ? { isin } : {}),
        },
      })
      createdCount++
      createdIds.add(stockId)
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
      }
    }

    console.log(`Successfully seeded stock-migration-mapping collection from CSV. Inserted ${createdCount} docs.`)
  } catch (error) {
    console.error('Error seeding stock-migration-mapping from CSV:', error)
    throw error
  }
}
