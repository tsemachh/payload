import sql from 'mssql'

// SQL Server configuration
export const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'dbEmda', // Use the actual database name
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false, // For local dev, set to false
    trustServerCertificate: true, // For local dev
  },
  requestTimeout: 120000, // Increase timeout globally to 120 seconds
}
