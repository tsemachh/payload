import { NextRequest, NextResponse } from 'next/server'
import { getClientIP } from '@/utils/getClientIP'

export async function GET(request: NextRequest) {
  // Mock payload request for getClientIP function
  const mockPayload = {
    logger: {
      info: () => {}, // Mock logger to avoid console output
    }
  }

  // Create mock request object with Payload structure
  const mockRequest = {
    headers: request.headers,
    payload: mockPayload,
    // Add Express-like properties if they exist
    ip: (request as any).ip,
    connection: (request as any).connection,
    socket: (request as any).socket,
  }

  // Get detected IP using our function
  const detectedIP = getClientIP(mockRequest)

  // Collect all header information
  const headers: { [key: string]: string | null } = {}
  const headerKeys = [
    'x-forwarded-for',
    'x-real-ip',
    'forwarded',
    'x-client-ip',
    'cf-connecting-ip',
    'true-client-ip',
    'x-forwarded-proto',
    'x-forwarded-host',
    'user-agent',
    'host',
  ]

  headerKeys.forEach(key => {
    headers[key] = request.headers.get(key)
  })

  // Get Next.js request info
  const nextjsInfo = {
    ip: (request as any).ip,
    geo: (request as any).geo,
    url: request.url,
    method: request.method,
  }

  // Get connection info if available
  const connectionInfo = {
    remoteAddress: (request as any).connection?.remoteAddress,
    remoteFamily: (request as any).connection?.remoteFamily,
    remotePort: (request as any).connection?.remotePort,
    localAddress: (request as any).connection?.localAddress,
    localPort: (request as any).connection?.localPort,
  }

  const result = {
    timestamp: new Date().toISOString(),
    detectedIP,
    headers,
    nextjsInfo,
    connectionInfo,
    rawHeadersCount: Array.from(request.headers.keys()).length,
    allHeaderKeys: Array.from(request.headers.keys()).sort(),
  }

  return NextResponse.json(result, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  })
}

export async function POST(request: NextRequest) {
  return GET(request) // Same logic for POST requests
}