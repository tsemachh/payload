import { PayloadRequest } from 'payload'
import { Company, HoldingFeedLine, HoldingsFeed, Stock } from '@/payload-types'
import { StandardizedRow } from '@/collections/holdings/feeds/FeedTypes'

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
  if (holdings.docs.length > 0) {
    return holdings.docs[0]
  }

  return null
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
      company: {
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
      depth: 0
    })

    // Collect all silenced stocks from all companies
    const silencedStocksSet = new Set<string>()
    result.docs.forEach(company => {
      const silencedStocks = company.silencedStocks || []
      silencedStocks.forEach((stockId: string) => {
        if (stockId) {
          silencedStocksSet.add(stockId)
        }
      })
    })

    // Convert to array of objects with stockId property
    return Array.from(silencedStocksSet).map(stockId => ({ stockId }))
  } catch (error) {
    console.error('שגיאה בקריאה לניירות מושתקים:', error);
    return [];
  }
};
/**
 * Preload accounts from companies
 * @param req The payload request
 * @param selectedCompanies The selected companies
 * @returns Map of account numbers to account IDs
 */
export const preloadAccountsToCompanyMap = async (
  req: PayloadRequest,
  selectedCompanies: string[],
): Promise<Map<number, string>> => {
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

  const accountToCompanyMap: Map<number, string> = new Map()

  companies.docs.forEach((company: Company) => {
    const accounts = company?.mainAccount

    accounts?.forEach((account) => {
      accountToCompanyMap.set(parseInt(account?.accountNumber), company?.id)

      account?.subAccounts?.forEach((subAccount) => {
        accountToCompanyMap.set(parseInt(subAccount), company?.id)
      })
    })
  })

  return accountToCompanyMap
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
): Promise<{ stockIdMap: Map<string, string>; stockNameMap: Map<string, string> }> => {

  const feedStocks: string[] = standardizedRows
    .map((row) => row.stockId)
    .filter((stockId): stockId is string => typeof stockId === 'string' && stockId !== '')

  const stockIdMap: Map<string, string> = new Map()
  const stockNameMap: Map<string, string> = new Map()

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

    stockIdMap.set(stockKey, stockValue)
    stockNameMap.set(stockKey, stockName as string)
  })

  return { stockIdMap, stockNameMap }
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
  // Aggregate records with the same accountId and stockId
  const aggregatedRecords = new Map<string, { company: string; stock: string; quantity: number }>()

  for (const record of processedRecords) {
    if (record.status === 'success') {
      const accountId = parseInt(record.accountId as string)
      const company = accountToCompanyMap.get(accountId) as string
      const stock = stockMap.get(record.stockId as string) as string

      // Create a unique key for each account-stock combination
      const key = `${company}-${stock}`

      if (aggregatedRecords.has(key)) {
        // If this combination already exists, add to the quantity
        const existingRecord = aggregatedRecords.get(key)!
        existingRecord.quantity += record.quantity as number
      } else {
        // Otherwise, create a new entry
        aggregatedRecords.set(key, {
          company,
          stock,
          quantity: record.quantity as number,
        })
      }
    }
  }

  // Create holdings from the aggregated records in batches
  const batchSize = 50; // Adjust based on your system's capacity
  const records = Array.from(aggregatedRecords.values());
  const totalRecords = records.length;

  req.payload.logger.info(`Creating ${totalRecords} holdings in batches of ${batchSize}`);

  for (let i = 0; i < totalRecords; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchPromises = batch.map(record => {
      return req.payload.create({
        collection: 'holdings',
        data: {
          company: record.company,
          stock: record.stock,
          quantity: record.quantity,
          valueDate,
        },
      }).catch(error => {
        req.payload.logger.error(`Error creating holding: ${JSON.stringify(error)}`);
        return null;
      });
    });

    try {
      await Promise.all(batchPromises);
      req.payload.logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalRecords / batchSize)}`);
    } catch (error) {
      req.payload.logger.error(`Error processing batch: ${JSON.stringify(error)}`);
    }
  }
}
