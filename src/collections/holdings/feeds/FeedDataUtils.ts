import { PayloadRequest } from 'payload'
import { Company, HoldingFeedLine, HoldingsFeed, Stock } from '@/payload-types'
import { StandardizedRow } from '@/collections/holdings/feeds/FeedTypes'
import { getStockByStockId } from '@/utils/utils'

type AggregatedRecord = {
  company: string
  stock: string
  quantity: number
  feedStockNum?: string
  originalForeignData?: {
    stockId: string
    accountNum?: number | null
    quantity: number
  }[]
}

export async function getPreviousFeed(
  req: PayloadRequest,
  currentDate: string,
  selectedCompanies: string[],
): Promise<HoldingsFeed | null> {
  const holdings = await req.payload.find({
    collection: 'holdings-feed',
    where: {
      valueDate: { less_than: new Date(currentDate).toISOString() },
      selectedCompanies: {
        contains: selectedCompanies,
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
  await req.payload.delete({
    collection: 'holdings',
    where: {
      valueDate: { equals: new Date(valueDate).toISOString() },
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
    where: {
      id: {
        in: selectedCompanies,
      },
    },
    limit: 0,
    depth: 2,
  })

  const accountToCompanyMapI: Map<number, string> = new Map()
  const accountNameMap: Map<number, string> = new Map()

  companies.docs.forEach((company: Company) => {
    const accounts = company?.mainAccount
    accounts?.forEach((account) => {
      accountToCompanyMapI.set(parseInt(account?.accountNumber), company?.id)
      accountNameMap.set(parseInt(account?.accountNumber), company?.name)
      account?.subAccounts?.forEach((subAccount) => {
        accountToCompanyMapI.set(parseInt(subAccount), company?.id)
        accountNameMap.set(parseInt(account?.accountNumber), company?.name)
      })
    })
  })

  return { accountToCompanyMapI, accountNameMap }
}
/**
 * Preload stocks from stock IDs
 * @param req The payload request
 * @param standardizedRows
 * @returns Map of stock IDs to stock documents
 */
export const preloadStocks = async (
  req: PayloadRequest,
  standardizedRows: StandardizedRow[],
): Promise<{
  stockIdMap: Map<string, string>
  stockNameMap: Map<string, string>
  stockActiveMap: Map<string, boolean>
}> => {
  const feedStocks: string[] = standardizedRows
    .map((row) => row.stockId)
    .filter((stockId): stockId is string => typeof stockId === 'string' && stockId !== '')

  const stockIdMap: Map<string, string> = new Map()
  const stockNameMap: Map<string, string> = new Map()
  const stockActiveMap: Map<string, boolean> = new Map()

  const stocksResult = await req.payload.find({
    collection: 'stocks',
    where: {
      stockId: {
        in: feedStocks,
      },
    },
    depth: 1,
    limit: 0,
  })

  stocksResult.docs.forEach((stock: Stock) => {
    // Ensure related.docs exists and check if it's not empty
    const hasRelatedDocs = stock?.relations?.docs && stock.relations.docs.length > 0
    const stockKey = stock?.stockId
    const stockValue =
      stock?.relatedStock && hasRelatedDocs
        ? ((stock.relatedStock as Stock).id as string)
        : stock?.id
    const stockName =
      stock?.relatedStock && hasRelatedDocs
        ? ((stock.relatedStock as Stock).fullName as string)
        : stock?.name
    const isActive = stock?.active !== false // Default to true if undefined or null

    stockIdMap.set(stockKey, stockValue)
    stockNameMap.set(stockKey, stockName as string)
    stockActiveMap.set(stockKey, isActive)
  })

  return { stockIdMap, stockNameMap, stockActiveMap }
}
/**
 * Create holdings from processed records
 * @param req The payload request
 * @param processedRecords The processed records
 * @param accountToCompanyMap
 * @param stockMap
 * @param valueDate The value date
 */
export const createHoldings = async (
  req: PayloadRequest,
  processedRecords: HoldingFeedLine[],
  accountToCompanyMap: Map<number, string>,
  stockMap: Map<string, string>,
  valueDate: string,
): Promise<void> => {
  const aggregatedRecords = new Map<string, AggregatedRecord>()

  for (const record of processedRecords) {
    if (record.status === 'success') {
      const accountId = parseInt(record.accountId as string)
      const company = accountToCompanyMap.get(accountId) as string
      const stock = stockMap.get(record.stockId as string) as string
      const key = `${company}-${stock}-${record.stockId}`

      const existingRecord = aggregatedRecords.get(key)
      const stockData = await getStockByStockId(req.payload, record.stockId)
      if (existingRecord) {
        if (stockData?.origin === 'Foreign') {
          existingRecord.originalForeignData = existingRecord.originalForeignData || []
          existingRecord.originalForeignData.push({
            stockId: record.stockId as string,
            accountNum: parseInt(record.accountId as string),
            quantity: record.quantity ?? 0,
          })
        }
        existingRecord.quantity += record.quantity ?? 0
      } else {
        if (stockData?.origin === 'Foreign') {
          aggregatedRecords.set(key, {
            company,
            stock,
            quantity: record.quantity ?? 0,
            feedStockNum: record.stockId as string,
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
            feedStockNum: record.stockId as string,
            quantity: record.quantity ?? 0,
          })
        }
      }
    }
  }

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
        feedStockNum: record.feedStockNum ?? '',
        originalForeignData: record.originalForeignData,
      })
    } else {
      holdingsArray.push({
        stock: record.stock,
        quantity: record.quantity,
        feedStockNum: record.feedStockNum ?? '',
      })
    }
  }

  for (const [company, holdings] of companyRecordsMap.entries()) {
    await req.payload
      .create({
        collection: 'holdings',
        data: {
          fund: company,
          holdings,
          valueDate,
        },
        req,
      })
      .catch((error) => {
        req.payload.logger.error(
          `Error creating holding for company ${company}: ${JSON.stringify(error)}`,
        )
        return null
      })
  }
}
