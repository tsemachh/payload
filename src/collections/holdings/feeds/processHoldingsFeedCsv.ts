import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import * as XLSX from 'xlsx'
import { Account, Company, HoldingsFeed, Stock } from '@/payload-types'

interface HoldingImport {
  stockId: string
  quantity: number
  accountId: string
  lineNumber: number
  status: 'success' | 'error'
  error?: string
}

/**
 * Process holdings feed CSV or XLSX file
 * 
 * Note: This function assumes that both CSV and XLSX files are without headers
 * and have columns in the following order:
 * Column 0: Stock ID
 * Column 1: Quantity
 * Column 2: Account ID
 */
export const processHoldingsFeedCsv = async (req: PayloadRequest, doc: HoldingsFeed): Promise<void> => {
  try {
    // Get the file from the request
    const file = req.file

    if (!file) {
      req.payload.logger.error(`No file found in request`)
      return
    }

    // Get the value date from the document
    const valueDate = doc.valueDate
    if (!valueDate) {
      await req.payload.update({
        collection: 'holdings-feed' as any,
        id: doc.id,
        data: {
          processingStatus: 'failed',
          processingErrors: [{ error: 'Missing value date' }],
        },
      })
      return
    }

    // Check user permissions
    if (!req.user) {
      await req.payload.update({
        collection: 'holdings-feed' as any,
        id: doc.id,
        data: {
          processingStatus: 'failed',
          processingErrors: [{ error: 'User not authenticated' }],
        },
      })
      return
    }

    // Check for existing holdings on the same date
    const existingHoldings = await req.payload.find({
      collection: 'holdings',
      where: {
        valueDate: {
          equals: valueDate,
        },
      },
    })

    if (existingHoldings.docs.length > 0) {
      // This should be handled by the UI with a confirmation prompt
      req.payload.logger.warn(`Found ${existingHoldings.docs.length} existing holdings for date ${valueDate}`)
    }

    // Parse the file content
    let results: any[] = []
    const fileExt = file.name.split('.').pop()?.toLowerCase()

    if (fileExt === 'csv') {
      const csvData = file.data.toString('utf8')
      // Parse CSV without using generateHeaderNames which can cause errors
      results = csvToJson.fieldDelimiter(',').csvStringToJson(csvData)
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.read(file.data, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      // Use header: 1 option to handle XLSX without headers
      results = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    } else {
      await req.payload.update({
        collection: 'holdings-feed' as any,
        id: doc.id,
        data: {
          processingStatus: 'failed',
          processingErrors: [{ error: `Unsupported file format: ${fileExt}` }],
        },
      })
      return
    }

    // Process records
    const processedRecords: HoldingImport[] = []
    const errors: any[] = []
    const accountsToCheck: Set<string> = new Set()
    const stocksToCheck: Set<string> = new Set()

    // Define column indices for files without headers
    // Assuming the columns are in a specific order: stockId, quantity, accountId
    const STOCK_ID_COL = 0;
    const QUANTITY_COL = 1;
    const ACCOUNT_ID_COL = 2;

    // Collect previous feed data for comparison
    const previousFeedDate = await getPreviousFeedDate(req, valueDate)
    const previousAccounts = new Set<string>()

    if (previousFeedDate) {
      const previousHoldings = await req.payload.find({
        collection: 'holdings',
        where: {
          valueDate: {
            equals: previousFeedDate,
          },
        },
        limit: 1000,
      })

      previousHoldings.docs.forEach(holding => {
        if (holding.account) {
          // @ts-ignore
          previousAccounts.add(holding.account.toString())
        }
      })
    }
    //preload accounts
    const companies= await req.payload.find({
      collection: 'companies',
      where:{
        id:{
          in: doc.selectedCompanies
        }
      },
      depth: 1
    })
    const accountMap:Map<number,string>= new Map()
    companies.docs.forEach((company:Company)=>{
      const accounts=company?.accounts?.docs as Account[]
      accounts.forEach((account)=>{
        accountMap.set(account?.accountNumber,account?.id)
      })
    })

    //TODO Standartize the JSON to be in standart format for CSV and Excer

    //TODO get all StockIds from CSV and perform find to get all stocks
    const feedStocks:string[]=[]//TODO get from the Typed JSON
    const stockMap:Map<string,string>= new Map()
    const stocksResult= await req.payload.find({
      collection: 'stocks',
      where:{
        stockId:{
          in: feedStocks
        }
      },
      depth: 1
    })
    stocksResult.docs.forEach((stock:Stock)=>{
      stockMap.set(stock?.stockId,stock?.id)
    })

    // Process each row
    results.forEach((row, index) => {
      const lineNumber = index + 1
      let stockId = ''
      let quantity = 0
      let accountId = ''

      // Extract values using column indices for files without headers
      if (Array.isArray(row)) {
        // For XLSX files with header: 1 option, row is an array
        stockId = row[STOCK_ID_COL]?.toString() || '';
        quantity = parseFloat(row[QUANTITY_COL]?.toString() || '0');
        accountId = row[ACCOUNT_ID_COL]?.toString() || '';
      } else {
        // For CSV files, row is an object with keys from the first row
        // We still use numeric indices to access the values
        stockId = row[STOCK_ID_COL.toString()]?.toString() || '';
        quantity = parseFloat(row[QUANTITY_COL.toString()]?.toString() || '0');
        accountId = row[ACCOUNT_ID_COL.toString()]?.toString() || '';
      }

      // Validate the record
      let isValid = true
      let errorMessage = ''

      // Check required fields
      if (!stockId) {
        isValid = false
        errorMessage = 'Missing stock ID'
      } else if (isNaN(quantity) || quantity < 1) {
        isValid = false
        errorMessage = 'Invalid quantity: must be a positive number >= 1'
      } else if (!accountId) {
        isValid = false
        errorMessage = 'Missing account ID'
      }

      // Add to sets for bulk validation
      if (isValid) {
        accountsToCheck.add(accountId)
        stocksToCheck.add(stockId)
      }

      processedRecords.push({
        stockId,
        quantity,
        accountId,
        lineNumber,
        status: isValid ? 'success' : 'error',
        error: errorMessage,
      })

      if (!isValid) {
        errors.push({
          lineNumber,
          stockId,
          accountId,
          quantity: quantity.toString(),
          error: errorMessage,
        })
      }
    })

    // Validate accounts exist
    const accountIds = Array.from(accountsToCheck)
    const accounts = await req.payload.find({
      collection: 'accounts',
      where: {
        accountNumber: {
          in: accountIds,
        },
      },
    })

    const validAccountIds = new Set(accounts.docs.map(account => account.accountNumber.toString()))
    const invalidAccountIds = new Set([...accountIds].filter(id => !validAccountIds.has(id.toString())))

    // Validate stocks exist
    const stockIds = Array.from(stocksToCheck)
    const stocks = await req.payload.find({
      collection: 'stocks',
      where: {
        stockId: {
          in: stockIds,
        },
      },
    })

    const validStockIds = new Set(stocks.docs.map(stock => stock.stockId))
    const invalidStockIds = new Set([...stockIds].filter(id => !validStockIds.has(id)))

    // Check for missing accounts compared to previous feed
    const currentAccounts = new Set(accountIds)
    const missingAccounts = [...previousAccounts].filter(id => !currentAccounts.has(id))

    if (missingAccounts.length > 0) {
      req.payload.logger.warn(`Missing ${missingAccounts.length} accounts compared to previous feed`)
    }

    // Check if the number of records is significantly different from previous feed
    if (previousFeedDate) {
      const previousCount = previousAccounts.size
      const currentCount = results.length
      const percentDifference = Math.abs(currentCount - previousCount) / previousCount * 100

      if (percentDifference > 5) {
        req.payload.logger.warn(`Line count differs by more than 5% from previous feed: ${percentDifference.toFixed(2)}%`)
      }
    }

    // Update records with validation results
    processedRecords.forEach(record => {
      if (record.status === 'success') {
        if (invalidAccountIds.has(record.accountId)) {
          record.status = 'error'
          record.error = 'Unknown account ID'
          errors.push({
            lineNumber: record.lineNumber,
            stockId: record.stockId,
            accountId: record.accountId,
            quantity: record.quantity.toString(),
            error: 'Unknown account ID',
          })
        } else if (invalidStockIds.has(record.stockId)) {
          record.status = 'error'
          record.error = 'Unknown stock ID'
          errors.push({
            lineNumber: record.lineNumber,
            stockId: record.stockId,
            accountId: record.accountId,
            quantity: record.quantity.toString(),
            error: 'Unknown stock ID',
          })
        }
      }
    })

    // If there are errors, update the document with the errors
    if (errors.length > 0) {
      await req.payload.update({
        collection: 'holdings-feed' as any,
        id: doc.id,
        data: {
          processingStatus: 'failed',
          processingErrors: errors,
        },
      })
      return
    }

    // Delete existing holdings for the date
    await deleteExistingHoldings(req, valueDate)

    // Insert new holdings
    for (const record of processedRecords) {
      if (record.status === 'success') {
        try {
          // Find the account document
          const account = accounts.docs.find(
            a => a.accountNumber.toString() === record.accountId.toString()
          )

          // Find the stock document
          const stock = stocks.docs.find(
            s => s.stockId === record.stockId
          )

          if (account && stock) {
            await req.payload.create({
              collection: 'holdings',
              data: {
                account: account.id,
                stock: stock.id,
                quantity: record.quantity,
                valueDate,
              },
            })
          }
        } catch (error) {
          req.payload.logger.error(`Error creating holding: ${JSON.stringify(error)}`)
        }
      }
    }

    // Update the document status
    await req.payload.update({
      collection: 'holdings-feed' as any,
      id: doc.id,
      data: {
        processingStatus: 'completed',
      },
    })

    req.payload.logger.info(`Successfully processed ${processedRecords.length} holdings for date ${valueDate}`)
  } catch (error) {
    req.payload.logger.error(`Error processing holdings feed: ${JSON.stringify(error)}`)

    // Update the document status
    await req.payload.update({
      collection: 'holdings-feed' as any,
      id: doc.id,
      data: {
        processingStatus: 'failed',
        processingErrors: [{ error: `General processing error: ${error}` }],
      },
    })
  }
}

// Helper function to delete existing holdings for a date
async function deleteExistingHoldings(req: PayloadRequest, valueDate: string): Promise<void> {
  const existingHoldings = await req.payload.find({
    collection: 'holdings',
    where: {
      valueDate: {
        equals: valueDate,
      },
    },
    limit: 1000,
  })

  for (const holding of existingHoldings.docs) {
    await req.payload.delete({
      collection: 'holdings',
      id: holding.id,
    })
  }
}

// Helper function to get the date of the most recent holdings feed
async function getPreviousFeedDate(req: PayloadRequest, currentDate: string): Promise<string | null> {
  const holdings = await req.payload.find({
    collection: 'holdings',
    where: {
      valueDate: {
        not_equals: currentDate,
      },
    },
    sort: '-valueDate',
    limit: 1,
  })

  if (holdings.docs.length > 0) {
    return holdings.docs[0].valueDate as string
  }

  return null
}
