'use client'

import { useFormFields } from '@payloadcms/ui'
import { useState, useEffect } from 'react'
import { stringify } from 'qs-esm'
import { CheckboxFilter } from './CheckboxFilter'

export type CheckboxFilterState = 'indeterminate' | 'checked' | 'unchecked'

type Fund = {
  id: string
  name: string
  quantity: number
  isAuthorized: CheckboxFilterState
  actualHolding: number
  feedStockNum?: string
}

export default function FundsWithHoldings() {
  const [funds, setFunds] = useState<Fund[]>([])
  const [updatedHoldings, setUpdatedHoldings] = useState<Record<string, string | number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

        // מיפוי התיקים עם האחזקות - מסנן רשומות עם quantity = 0
        const fundsWithHoldings = subCompanies
          .map((subCo: { id: any; name: any }) => {
            const holding = fundsWithHolding.find((h: { fund: any }) => h.fund === subCo.id) || {}
            return {
              id: subCo.id,
              name: subCo.name,
              quantity: holding.quantity || 0,
              isAuthorized: 'indeterminate' as CheckboxFilterState,
              actualHolding: holding.ownedQuantity || 0,
              feedStockNum: holding.feedStockNum || '',
            }
          })
          .filter((fund: Fund) => fund.quantity > 0) // מסנן רשומות עם ערך נקוב = 0

        setFunds(fundsWithHoldings)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('שגיאה בטעינת נתונים')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [meeting, company])

  const handleCheckboxChange = (fundId: string, state: CheckboxFilterState) => {
    setFunds((prev) =>
      prev.map((fund) => (fund.id === fundId ? { ...fund, isAuthorized: state } : fund)),
    )

    // אם עוברים ממצב "unchecked" למצב אחר, מנקים את השדה
    if (state !== 'unchecked') {
      setUpdatedHoldings((prev) => {
        const newHoldings = { ...prev }
        delete newHoldings[fundId]
        return newHoldings
      })
    }
  }

  const handleInputChange = (fundId: string, value: string) => {
    // אפשר הקלדה של נקודה ומספרים
    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
      setUpdatedHoldings((prev) => ({
        ...prev,
        [fundId]: value,
      }))
    }
  }

  return (
    <div style={{ margin: '20px 0', padding: '10px' }}>
      {loading && <p style={{ color: '#666' }}>טוען נתונים...</p>}
      {error && <p style={{ color: '#d32f2f' }}>{error}</p>}
      {funds.length === 0 && !loading && !error && (
        <p style={{ color: '#666' }}>אין תיקים זמינים להצגה</p>
      )}

      {funds.length > 0 && (
        <table
          style={{
            width: '800px',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th
                style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#111827',
                }}
              >
                שם תיק
              </th>
              <th
                style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#111827',
                }}
              >
                ערך נקוב במערכת
              </th>
              <th
                style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#111827',
                }}
              >
                אימות אחזקות
              </th>
              <th
                style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#111827',
                }}
              >
                ערך נקוב ברשות
              </th>
            </tr>
          </thead>
          <tbody>
            {funds.map((fund, index) => (
              <tr
                key={fund.id}
                style={{
                  borderBottom: '1px solid #f3f4f6',
                  backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#fafafa')
                }
              >
                <td
                  style={{
                    padding: '16px 24px',
                    fontSize: '14px',
                    color: '#111827',
                    fontWeight: '500',
                  }}
                >
                  {fund.name}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '14px', color: '#374151' }}>
                  {fund.quantity.toLocaleString()}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <CheckboxFilter
                    value={fund.isAuthorized}
                    onChange={(state: any) => handleCheckboxChange(fund.id, state)}
                  />
                </td>
                <td style={{ padding: '16px 24px' }}>
                  {fund.isAuthorized === 'unchecked' && (
                    <input
                      type="text"
                      value={updatedHoldings[fund.id] ?? fund.actualHolding}
                      onChange={(e) => handleInputChange(fund.id, e.target.value)}
                      style={{
                        width: '120px',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        textAlign: 'right',
                        direction: 'rtl',
                      }}
                      placeholder="הכנס ערך"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
