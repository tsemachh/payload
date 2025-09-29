'use client'

import { useState, useEffect } from 'react'

interface IPTestResult {
  timestamp: string
  detectedIP: string
  headers: { [key: string]: string | null }
  nextjsInfo: {
    ip?: string
    geo?: any
    url: string
    method: string
  }
  connectionInfo: {
    remoteAddress?: string
    remoteFamily?: string
    remotePort?: number
    localAddress?: string
    localPort?: number
  }
  rawHeadersCount: number
  allHeaderKeys: string[]
}

export default function TestIPPage() {
  const [ipData, setIpData] = useState<IPTestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIPData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/test-ip')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setIpData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch IP data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIPData()
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🔍 IP Detection Test Page</h1>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={fetchIPData}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '🔄 Testing...' : '🔄 Refresh Test'}
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#ffebee',
          color: '#c62828',
          padding: '15px',
          borderRadius: '5px',
          marginBottom: '20px',
          border: '1px solid #ef5350'
        }}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {ipData && (
        <div>
          <div style={{
            backgroundColor: '#e8f5e8',
            padding: '15px',
            borderRadius: '5px',
            marginBottom: '20px',
            border: '2px solid #4caf50'
          }}>
            <h2>🎯 Detected IP: <span style={{ color: '#2e7d32', fontSize: '1.2em' }}>{ipData.detectedIP}</span></h2>
            <p><strong>Timestamp:</strong> {ipData.timestamp}</p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '20px'
          }}>

            {/* Headers Section */}
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '5px',
              border: '1px solid #ddd'
            }}>
              <h3>📋 Request Headers ({ipData.rawHeadersCount} total)</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {Object.entries(ipData.headers).map(([key, value]) => (
                  <div key={key} style={{
                    marginBottom: '8px',
                    backgroundColor: value ? '#fff' : '#ffe0e0',
                    padding: '5px',
                    borderRadius: '3px',
                    fontSize: '0.9em'
                  }}>
                    <strong style={{ color: value ? '#1976d2' : '#666' }}>{key}:</strong>{' '}
                    <span style={{ color: value ? '#000' : '#999' }}>
                      {value || 'NOT_FOUND'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next.js Info Section */}
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '5px',
              border: '1px solid #ddd'
            }}>
              <h3>⚡ Next.js Request Info</h3>
              <div style={{ fontSize: '0.9em' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Method:</strong> {ipData.nextjsInfo.method}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>URL:</strong> {ipData.nextjsInfo.url}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Next.js IP:</strong>{' '}
                  <span style={{ color: ipData.nextjsInfo.ip ? '#1976d2' : '#999' }}>
                    {ipData.nextjsInfo.ip || 'NOT_AVAILABLE'}
                  </span>
                </div>
                {ipData.nextjsInfo.geo && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Geo Info:</strong> {JSON.stringify(ipData.nextjsInfo.geo)}
                  </div>
                )}
              </div>
            </div>

            {/* Connection Info Section */}
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '5px',
              border: '1px solid #ddd'
            }}>
              <h3>🔗 Connection Info</h3>
              <div style={{ fontSize: '0.9em' }}>
                {Object.entries(ipData.connectionInfo).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '8px' }}>
                    <strong>{key}:</strong>{' '}
                    <span style={{ color: value ? '#1976d2' : '#999' }}>
                      {value || 'NOT_AVAILABLE'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* All Headers List */}
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '5px',
              border: '1px solid #ddd'
            }}>
              <h3>📝 All Header Keys ({ipData.allHeaderKeys.length})</h3>
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                fontSize: '0.8em',
                lineHeight: '1.4'
              }}>
                {ipData.allHeaderKeys.map((key, index) => (
                  <div key={index} style={{
                    display: 'inline-block',
                    backgroundColor: '#fff',
                    margin: '2px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid #ddd'
                  }}>
                    {key}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Analysis Section */}
          <div style={{
            backgroundColor: '#fff3cd',
            padding: '15px',
            borderRadius: '5px',
            marginTop: '20px',
            border: '1px solid #ffc107'
          }}>
            <h3>🔬 Analysis</h3>
            <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
              <li>
                <strong>X-Forwarded-For Header:</strong>{' '}
                {ipData.headers['x-forwarded-for'] ?
                  <span style={{ color: '#28a745' }}>✅ Present: {ipData.headers['x-forwarded-for']}</span> :
                  <span style={{ color: '#dc3545' }}>❌ Missing</span>
                }
              </li>
              <li>
                <strong>X-Real-IP Header:</strong>{' '}
                {ipData.headers['x-real-ip'] ?
                  <span style={{ color: '#28a745' }}>✅ Present: {ipData.headers['x-real-ip']}</span> :
                  <span style={{ color: '#dc3545' }}>❌ Missing</span>
                }
              </li>
              <li>
                <strong>Detection Result:</strong>{' '}
                {ipData.detectedIP === '10.192.0.1' || ipData.detectedIP.startsWith('10.') ?
                  <span style={{ color: '#dc3545' }}>❌ Still showing internal IP</span> :
                  <span style={{ color: '#28a745' }}>✅ Showing real IP</span>
                }
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}