import { StockValue } from '@/payload-types'
import { parseNumber } from '../app/(frontend)/helpers/utils-data-table'
import { TreeCompanyType } from '@/types/companies'

export async function getBufferFromStream(stream: ReadableStream<Uint8Array>) {
  // Convert the ReadableStream to a Buffer using the ReadableStream API
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks)
}

export const calculateHoldingValues = (
  quantity: number,
  stockValues: StockValue | null | undefined | string,
  isRounded = true,
) => {
  let safeStockValue
  if (typeof stockValues == 'object' && stockValues !== null) {
    safeStockValue = stockValues
  } else {
    safeStockValue = { registeredValue: 0, closingRate: 0 }
  }

  const registeredValue = parseNumber(safeStockValue?.registeredValue) || 0
  const closingRate = parseNumber(safeStockValue?.closingRate) || 0

  // Handle division by zero for percentage calculation
  const percentageHolding =
    registeredValue > 0 ? parseFloat(((quantity / registeredValue) * 100).toFixed(4)) : 0

  const holdingValueInMillions = isRounded
    ? Math.round((quantity * closingRate) / 100000000)
    : (quantity * closingRate) / 100000000

  return {
    percentageHolding,
    holdingValueInMillions,
    nominalValue: Math.round(quantity),
  }
}

export function findRelevantCompanyIds(
  meetingCompanies: string[] | undefined,
  funds: string[] | null | undefined,
): string[] {
  return (meetingCompanies || [])
    .filter((companyID) => funds?.some((fund) => fund === companyID))
    .filter((id) => id !== null) as string[]
}
// Function to traverse the tree and build the map
export const buildFundToParentMap = (
  companies: TreeCompanyType[],
  fundToParentMap: Map<string, TreeCompanyType>,
) => {
  for (const company of companies) {
    if (company.subCompanies && company.subCompanies.length > 0) {
      // For each subCompany, set the current company as parent
      for (const subCompany of company.subCompanies) {
        fundToParentMap.set(subCompany.id, company)
      }
      // Recursively process subCompanies
      buildFundToParentMap(company.subCompanies, fundToParentMap)
    }
  }
}
