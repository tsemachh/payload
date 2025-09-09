import { PayloadRequest } from 'payload'
import { Company, HoldingFeedLine, HoldingsPerDay, Stock } from '@/payload-types'
import { StandardizedRow } from '@/collections/holdings/feeds/FeedTypes'

export type AggregatedRecord = {
  company: string
  stock: string
  quantity: number
  originalForeignData?: NonNullable<HoldingsPerDay[number]['originalForeignData']>
}

export async function getPreviousHoldings(
  req: PayloadRequest,
  currentDate: string,
  companyId: string,
): Promise<any | null> {
  const holdings = await req.payload.find({
    collection: 'holdings',
    where: {
      valueDate: { less_than: new Date(currentDate).toISOString() },
      fund: {
        equals: companyId,
      },
    },
    sort: '-valueDate',
    depth: 0,
    limit: 1,
  })

  return holdings.docs.length > 0 ? holdings.docs[0] : null
}

// Helper function to delete existing holdings for a date
export async function deleteExistingHoldings(
  req: PayloadRequest,
  valueDate: string,
  companies: string[],
): Promise<void> {
  const startValueDate = new Date(valueDate)
  startValueDate.setHours(0, 0, 0, 0)
  const endValueDate = new Date(valueDate)
  endValueDate.setHours(23, 59, 59, 999)
  await req.payload.delete({
    collection: 'holdings',
    where: {
      valueDate: {
        greater_than_equal: startValueDate.toISOString(),
        less_than_equal: endValueDate.toISOString(),
      },
      fund: {
        in: companies,
      },
    },
  })

  await req.payload.delete({
    collection: 'holdings-feed',
    where: {
      valueDate: {
        equals: valueDate,
      },
      selectedCompanies: {
        contains: companies,
      },
    },
  })
}

export const fetchAllSilencedStocks = async (
  req: PayloadRequest,
  companies: string[],
): Promise<{ stockId: string }[]> => {
  try {
    // Fetch companies with their silenced stocks
    const result = await req.payload.find({
      collection: 'companies',
      where: {
        id: {
          in: companies,
        },
      },
      limit: 0,
      depth: 0,
    })

    // Collect all silenced stocks from all companies
    const silencedStocksSet = new Set<string>()
    result.docs.forEach((company) => {
      const silencedStocks = company.silencedStocks || []
      silencedStocks.forEach((stockId: string) => {
        if (stockId) {
          silencedStocksSet.add(stockId)
        }
      })
    })

    // Convert to array of objects with stockId property
    return Array.from(silencedStocksSet).map((stockId) => ({ stockId }))
  } catch (error) {
    console.error('שגיאה בקריאה לניירות מושתקים:', error)
    return []
  }
}
/**
 * Preload accounts from companies
 * @param req The payload request
 * @param selectedCompanies The selected companies
 * @returns Map of account numbers to account IDs
 */
export const preloadAccountsToCompanyMap = async (
  req: PayloadRequest,
  selectedCompanies: string[],
): Promise<{
  accountToCompanyMapI: Map<number, string>
  accountNameMap: Map<number, string>
}> => {
  const companies = await req.payload.find({
    collection: 'companies',
    select: {
      mainAccount: true,
    },
    where: {
      id: {
        in: selectedCompanies,
      },
    },
    limit: 0,
    depth: 0,
  })

  const accountToCompanyMapI: Map<number, string> = new Map()
  const accountNameMap: Map<number, string> = new Map()

  companies.docs.forEach((company: Partial<Company>) => {
    const accounts = company?.mainAccount
    accounts?.forEach((account) => {
      accountToCompanyMapI.set(parseInt(account?.accountNumber), company?.id as string)
      accountNameMap.set(parseInt(account?.accountNumber), company?.name as string)
      account?.subAccounts?.forEach((subAccount) => {
        accountToCompanyMapI.set(parseInt(subAccount), company?.id as string)
        accountNameMap.set(parseInt(account?.accountNumber), company?.name as string)
      })
    })
  })

  return { accountToCompanyMapI, accountNameMap }
}
/**
 * Preload stocks from stock IDs
 * @param req The payload request
 * @param standardizedRows
 * @returns Map of stock IDs to stock information objects
 */
export const preloadStocks = async (
  req: PayloadRequest,
  standardizedRows: StandardizedRow[],
): Promise<
  Map<
    string,
    {
      stockParentMongoId: string
      stockName: string
      isActive: boolean
      origin: string
    }
  >
> => {
  const feedStocks: string[] = standardizedRows
    .map((row) => row.stockId)
    .filter((stockId): stockId is string => typeof stockId === 'string' && stockId !== '')

  const stocksMap = new Map<
    string,
    {
      stockParentMongoId: string
      stockName: string
      isActive: boolean
      origin: string
    }
  >()

  const stocksResult = await req.payload.find({
    collection: 'stocks',
    select: {
      relations: true,
      stockId: true,
      relatedStock: true,
      name: true,
      active: true,
      origin: true,
    },
    where: {
      stockId: {
        in: feedStocks,
      },
    },
    depth: 1,
    limit: 0,
  })

  stocksResult.docs.forEach((stock: Partial<Stock>) => {
    // Ensure related.docs exists and check if it's not empty
    const hasRelatedDocs = stock?.relations?.docs && stock.relations.docs.length > 0
    const stockKey = stock?.stockId
    const stockParentMongoId =
      stock?.relatedStock && hasRelatedDocs
        ? ((stock.relatedStock as Stock).id as string)
        : stock?.id
    const stockName =
      stock?.relatedStock && hasRelatedDocs
        ? ((stock.relatedStock as Stock).name as string)
        : stock?.name
    const isActive = stock?.active !== false // Default to true if undefined or null
    const origin = stock?.origin as string

    stocksMap.set(stockKey as string, {
      stockParentMongoId: stockParentMongoId as string,
      stockName: stockName as string,
      isActive,
      origin,
    })
  })

  return stocksMap
}
/**
 * Create holdings from processed records
 * @param req The payload request
 * @param processedRecords The processed records
 * @param accountToCompanyMap Map of account numbers to company IDs
 * @param stocksMap Map of stock IDs to stock information objects
 * @param valueDate The value date
 */

export const createHoldings = async (
  req: PayloadRequest,
  processedRecords: HoldingFeedLine[],
  accountToCompanyMap: Map<number, string>,
  stocksMap: Map<
    string,
    {
      stockParentMongoId: string
      stockName: string
      isActive: boolean
      origin: string
    }
  >,
  valueDate: string,
): Promise<void> => {
  const aggregatedRecords = new Map<string, AggregatedRecord>()

  // Collect all unique stock IDs
  const stockIds = new Set<string>()
  for (const record of processedRecords) {
    if (record.status === 'success' && record.stockId) {
      stockIds.add(record.stockId as string)
    }
  }

  // Process and aggregate records
  for (const record of processedRecords) {
    if (record.status === 'success') {
      const accountId = parseInt(record.accountId as string)
      const company = accountToCompanyMap.get(accountId) as string
      const stockInfo = stocksMap.get(record.stockId as string)
      const stock = stockInfo?.stockParentMongoId as string
      const key = `${company}-${stock}-${record.stockId}`

      const existingRecord = aggregatedRecords.get(key)

      // Check if stock is foreign based on its origin property
      const isForeignStock = stockInfo?.origin === 'Foreign'

      if (existingRecord) {
        if (isForeignStock) {
          existingRecord.originalForeignData = existingRecord.originalForeignData || []
          existingRecord.originalForeignData.push({
            stockId: record.stockId as string,
            accountNum: parseInt(record.accountId as string),
            quantity: record.quantity ?? 0,
          })
        }
        existingRecord.quantity += record.quantity ?? 0
      } else {
        if (isForeignStock) {
          aggregatedRecords.set(key, {
            company,
            stock,
            quantity: record.quantity ?? 0,
            originalForeignData: [
              {
                stockId: record.stockId as string,
                accountNum: parseInt(record.accountId as string),
                quantity: record.quantity ?? 0,
              },
            ],
          })
        } else {
          aggregatedRecords.set(key, {
            company,
            stock,
            quantity: record.quantity ?? 0,
          })
        }
      }
    }
  }

  // Create company records map
  const companyRecordsMap = new Map<string, Array<any>>()

  for (const record of aggregatedRecords.values()) {
    if (!companyRecordsMap.has(record.company)) {
      companyRecordsMap.set(record.company, [])
    }

    const holdingsArray = companyRecordsMap.get(record.company)!

    if (record.originalForeignData) {
      holdingsArray.push({
        stock: record.stock,
        quantity: record.quantity,
        originalForeignData: record.originalForeignData,
      })
    } else {
      holdingsArray.push({
        stock: record.stock,
        quantity: record.quantity,
      })
    }
  }

  // Create holdings in database
  let successCount = 0
  for (const [company, holdings] of companyRecordsMap.entries()) {
    // Calculate statistics for this company
    const companyRecords = processedRecords.filter((record) => {
      if (record.status === 'success' && record.accountId) {
        const accountId = parseInt(record.accountId as string)
        const recordCompany = accountToCompanyMap.get(accountId)
        return recordCompany === company
      }
      return false
    })

    const companyAccountIds = new Set<string>()
    companyRecords.forEach((record) => {
      if (record.accountId) {
        companyAccountIds.add(record.accountId.toString())
      }
    })

    await req.payload
      .create({
        collection: 'holdings',
        data: {
          fund: company,
          holdings,
          valueDate,
          stats: {
            recordCount: companyRecords.length,
            accountIds: JSON.stringify(Array.from(companyAccountIds)),
          },
        },
        req,
      })
      .then(() => {
        successCount++
      })
      .catch((error) => {
        req.payload.logger.error(
          `Error creating holding for company ${company}: ${JSON.stringify(error)}`,
        )
        return null
      })
  }
}
