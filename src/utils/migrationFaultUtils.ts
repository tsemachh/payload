import { Payload } from 'payload'
import { MigrationType } from '@/payload-types'

export type MigrationFaultType = 'stock' | 'stock-relation' | 'stock-value'

interface LogMigrationFaultProps {
  payload: Payload
  type: MigrationType
  typeId: string
  comments: string
  row?: string
}

/**
 * Logs a migration fault to the migration-faults collection
 * @param props Properties for the migration fault
 * @returns Promise that resolves when the fault is logged
 */
export async function logMigrationFault({
  payload,
  type,
  typeId,
  comments,
  row,
}: LogMigrationFaultProps): Promise<void> {
  try {
    payload.create({
      collection: 'migration-faults',
      data: {
        type,
        typeId,
        row: row ? JSON.stringify(row, null, 2) : undefined,
        comments,
      },
    })
    //    console.info(`✗ Migration fault logged for ${type} ${typeId}: ${comments}`)
  } catch (error) {
    console.error(`Failed to log migration fault for ${type} ${typeId}:`, error)
  }
}

/**
 * Creates a fault comment string for a stock that is not entitled to migration
 */
export function createStockFaultComment({
  isPredictaStock,
  isEmdaStock,
  hasTradableRelationStock,
  stockHasMeeting,
}: {
  isPredictaStock: boolean
  isEmdaStock: boolean
  hasTradableRelationStock: boolean
  stockHasMeeting: boolean
}): string {
  return `Stock not entitled to migration - isPredictaStock:${isPredictaStock} isEmdaStock:${isEmdaStock} hasTradableRelationStock:${hasTradableRelationStock} stockHasMeeting:${stockHasMeeting}`
}

/**
 * Creates a fault comment string for a stock relation that is not available
 */
export function createStockRelationFaultComment({
  stockId1,
  stockId2,
}: {
  stockId1: string
  stockId2: string
}): string {
  return `Stock relation not available - stock :${stockId1} to stock ${stockId2} i`
}

/**
 * Creates a fault comment string for a stock value migration error
 */
export function createStockValueFaultComment({
  stockId,
  error,
}: {
  stockId: string
  error: Error
}): string {
  return `Failed to migrate stock value for stock ${stockId}: ${error.message}`
}

/**
 * Creates a fault comment string for a general migration error
 */
export function createErrorFaultComment({
  operation,
  id,
  error,
}: {
  operation: string
  id: string
  error: Error
}): string {
  return `Failed to ${operation} for ID ${id}: ${error.message}`
}
