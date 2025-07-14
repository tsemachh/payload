'use client'

import { useFormFields } from '@payloadcms/ui'
import { useState, useEffect } from 'react'
import { stringify } from 'qs-esm'

type Fund = {
  id: string
  name: string
  quantity: number
  isAuthorized: boolean
  actualHolding: number
  feedStockNum?: string
}

export default function FundsWithHoldings() {
  const [Funds, setFunds] = useState<Fund[]>([])
  const [updatedHoldings, setUpdatedHoldings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fields = useFormFields(([f]) => f)

  const meeting = fields.meeting?.value
  const company = fields.company?.value

  useEffect(() => {
    const fetchData = async () => {
      if (!meeting || !company) {
        setError('חסרים נתוני אסיפה או חברה')
        return
      }

      setLoading(true)
      setError(null)

      try {
        // פתיחת החברה לקבלת subCompanies
        const companyQuery = {
          where: { id: { equals: company } },
          depth: 1,
          limit: 1,
        }
        const companyStringifiedQuery = stringify(companyQuery, { addQueryPrefix: true })
        const companyResponse = await fetch(`/api/companies${companyStringifiedQuery}`)

        if (!companyResponse.ok) {
          throw new Error(`HTTP error! status: ${companyResponse.status}`)
        }
        const companyData = await companyResponse.json()
        const subCompanies = companyData.docs[0]?.subCompanies || []

        // פתיחת האסיפה לקבלת fundsWithHolding
        const meetingQuery = {
          where: { id: { equals: meeting } },
          depth: 0,
          limit: 1,
        }
        const meetingStringifiedQuery = stringify(meetingQuery, { addQueryPrefix: true })
        const meetingResponse = await fetch(`/api/meetings${meetingStringifiedQuery}`)

        if (!meetingResponse.ok) {
          throw new Error(`HTTP error! status: ${meetingResponse.status}`)
        }

        const meetingData = await meetingResponse.json()
        const fundsWithHolding = meetingData.docs[0]?.fundsWithHolding || []

        // מיפוי התיקים עם האחזקות
        const FundsWithHoldings = subCompanies.map((subCo: { id: any; name: any }) => {
          const holding = fundsWithHolding.find((h: { fund: any }) => h.fund === subCo.id) || {}
          return {
            id: subCo.id,
            name: subCo.name,
            quantity: holding.quantity || 0,
            isAuthorized: false, // ערך זמני בממשק
            actualHolding: holding.ownedQuantity || 0, // משתמשים ב-ownedQuantity כבסיס ל-actualHolding
            feedStockNum: holding.feedStockNum || '',
          }
        })

        setFunds(FundsWithHoldings)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('שגיאה בטעינת נתונים')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [meeting, company])

  const handleCheckboxChange = (FundId: any, checked: boolean) => {
    setFunds((prev) => prev.map((p) => (p.id === FundId ? { ...p, isAuthorized: checked } : p)))
  }

  const handleInputChange = (FundId: string, value: string) => {
    const numericValue = parseFloat(value)
    if (isNaN(numericValue) || numericValue < 0) return // ולידציה בסיסית
    setUpdatedHoldings((prev) => ({
      ...prev,
      [FundId]: numericValue,
    }))
  }

  const saveChanges = async () => {
    if (!meeting) {
      setError('חסר מזהה אסיפה')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const newFundsWithHolding = Funds.map((p) => ({
        fund: p.id,
        quantity: p.quantity,
        ownedQuantity: p.isAuthorized ? updatedHoldings[p.id] || p.actualHolding : p.actualHolding,
        feedStockNum: p.feedStockNum || '',
      }))

      const response = await fetch(`/api/meetings/${meeting}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fundsWithHolding: newFundsWithHolding }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      setSuccess('השינויים נשמרו בהצלחה!')
    } catch (err) {
      console.error('Error saving changes:', err)
      setError('שגיאה בשמירת השינויים')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ margin: '20px 0', padding: '10px' }}>
      {loading && <p style={{ color: '#666' }}>טוען נתונים...</p>}
      {error && <p style={{ color: '#d32f2f' }}>{error}</p>}
      {success && <p style={{ color: '#2e7d32' }}>{success}</p>}
      {Funds.length === 0 && !loading && !error && (
        <p style={{ color: '#666' }}>אין תיקים זמינים להצגה</p>
      )}
      {Funds.length > 0 && (
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px', textAlign: 'right', color: '#333' }}>שם תיק</th>
              <th style={{ padding: '8px', textAlign: 'right', color: '#333' }}>ערך נקוב במערכת</th>
              <th style={{ padding: '8px', textAlign: 'right', color: '#333' }}>
                האם תואם אחזקות ברשות
              </th>
              <th style={{ padding: '8px', textAlign: 'right', color: '#333' }}>ערך נקוב ברשות</th>
            </tr>
          </thead>
          <tbody>
            {Funds.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{p.name}</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{p.quantity}</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  <input
                    type="checkbox"
                    checked={p.isAuthorized}
                    onChange={(e) => handleCheckboxChange(p.id, e.target.checked)}
                  />
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {p.isAuthorized && (
                    <input
                      type="number"
                      min="0"
                      value={updatedHoldings[p.id] ?? p.actualHolding}
                      onChange={(e) => handleInputChange(p.id, e.target.value)}
                      style={{
                        width: '100px',
                        padding: '4px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        onClick={saveChanges}
        disabled={loading}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          background: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
        }}
      >
        {loading ? 'שומר...' : 'שמור שינויים'}
      </button>
    </div>
  )
}
