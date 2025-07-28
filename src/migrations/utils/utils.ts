import sql from 'mssql'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// SQL Server configuration
export const sqlConfig: sql.config = {
  user: 'sa',
  password: process.env.MSSQL_PASSWORD || 'dockerStrongPwd123', // Use environment variable with fallback
  database: 'dbEmda', // Use the actual database name
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false, // For local dev, set to false
    trustServerCertificate: true, // For local dev
  },
  requestTimeout: 120000, // Increase timeout globally to 120 seconds
}

export async function createMSSqlPool() {
  let pool: sql.ConnectionPool | null = null

  console.log('\n=== Starting Firms Migration ===')
  console.log('Attempting to connect to SQL Server:', sqlConfig.server)

  // Log whether we're using the environment variable for the password
  if (process.env.MSSQL_PASSWORD) {
    console.log('Using password from environment variable')
  } else {
    console.log('Using default password (environment variable not set)')
  }

  // Connect to SQL Server
  try {
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')
    return pool
  } catch (error) {
    console.error('Failed to connect to SQL Server:', error)
    throw error
  }
}
