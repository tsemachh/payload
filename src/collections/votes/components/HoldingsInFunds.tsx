'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import { useState, useEffect } from 'react'
import { stringify } from 'qs-esm'
import { CheckboxFilter } from './CheckboxFilter'
import { JSONFieldClientProps } from 'payload'

export type CheckboxFilterState = 'indeterminate' | 'checked' | 'unchecked'

type Fund = {
  id: string
  name: string
  quantity: number
  isAuthorized: CheckboxFilterState
  actualHolding: number
  feedStockNum?: string
}

const FundsWithHoldings: React.FC<JSONFieldClientProps> = ({ path }) => {
  const [funds, setFunds] = useState<Fund[]>([])
  const [updatedHoldings, setUpdatedHoldings] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fields = useFormFields(([f]) => f)
  const meeting = fields.meeting?.value
  const company = fields.company?.value
  const { value, setValue } = useField<
    Record<string, { isAuthorized: CheckboxFilterState; ownedQuantity: number | null }>
  >({ path })

  useEffect(() => {
    const fetchData = async () => {
      if (!meeting || !company) {
        setError('חסרים נתוני אסיפה או חברה')
        return
      }

      setLoading(true)
      setError(null)

      try {
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
        console.log('Fetched fundsWithHolding:', fundsWithHolding)

        const fundsWithHoldings = subCompanies
          .map((subCo: { id: any; name: any }) => {
            const holding = fundsWithHolding.find((h: { fund: any }) => h.fund === subCo.id) || {}
            const existingData = value?.[subCo.id] || {}
            return {
              id: subCo.id,
              name: subCo.name,
              quantity: holding.quantity || 0,
              isAuthorized: existingData.isAuthorized || 'indeterminate',
              actualHolding: holding.ownedQuantity || 0,
              feedStockNum: holding.feedStockNum || '',
            }
          })
          .filter((fund: Fund) => fund.quantity > 0)

        console.log('Mapped funds with holdings:', fundsWithHoldings)
        setFunds(fundsWithHoldings)

        const initialUpdatedHoldings: Record<string, string> = {}
        const initialErrors: Record<string, string | null> = {}
        fundsWithHoldings.forEach((fund: Fund) => {
          if (
            value?.[fund.id]?.ownedQuantity !== undefined &&
            value?.[fund.id]?.isAuthorized === 'unchecked'
          ) {
            initialUpdatedHoldings[fund.id] =
              value[fund.id] && value[fund.id].ownedQuantity != null
                ? String(value[fund.id].ownedQuantity)
                : ''
            initialErrors[fund.id] = value[fund.id].ownedQuantity ? null : 'חובה להזין ערך'
          } else {
            initialErrors[fund.id] = null
          }
        })
        console.log('Initial updatedHoldings:', initialUpdatedHoldings)
        console.log('Initial errors:', initialErrors)
        setUpdatedHoldings(initialUpdatedHoldings)
        setErrors(initialErrors)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('שגיאה בטעינת נתונים')
      } finally {
        setLoading(false)
        console.log('Loading finished, loading:', false)
      }
    }

    fetchData()
  }, [meeting, company])

  useEffect(() => {
    const newValue: Record<
      string,
      { isAuthorized: CheckboxFilterState; ownedQuantity: number | null }
    > = {}
    funds.forEach((fund) => {
      newValue[fund.id] = {
        isAuthorized: fund.isAuthorized,
        ownedQuantity:
          fund.isAuthorized === 'unchecked'
            ? Number(updatedHoldings[fund.id]) || null
            : fund.quantity,
      }
    })
    console.log('Updating JSON field with newValue:', newValue)
    setValue(newValue)
  }, [funds, updatedHoldings])

  const handleCheckboxChange = (fundId: string, state: CheckboxFilterState) => {
    console.log('Checkbox changed for fund:', fundId, 'to state:', state)
    setFunds((prev) =>
      prev.map((fund) => (fund.id === fundId ? { ...fund, isAuthorized: state } : fund)),
    )

    if (state !== 'unchecked') {
      setUpdatedHoldings((prev) => {
        const newHoldings = { ...prev }
        delete newHoldings[fundId]
        console.log('Removed holding for fund:', fundId, 'newHoldings:', newHoldings)
        return newHoldings
      })
      setErrors((prev) => {
        const newErrors = { ...prev, [fundId]: null }
        console.log('Cleared error for fund:', fundId, 'newErrors:', newErrors)
        return newErrors
      })
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev, [fundId]: updatedHoldings[fundId] ? null : 'חובה להזין ערך' }
        console.log('Set error for fund:', fundId, 'newErrors:', newErrors)
        return newErrors
      })
    }
  }

  const handleInputChange = (fundId: string, inputValue: string) => {
    console.log('Input changed for fund:', fundId, 'value:', inputValue)
    if (inputValue === '' || /^-?\d*\.?\d*$/.test(inputValue)) {
      setUpdatedHoldings((prev) => ({
        ...prev,
        [fundId]: inputValue,
      }))
      setErrors((prev) => ({
        ...prev,
        [fundId]: inputValue ? null : 'חובה להזין ערך',
      }))
      console.log('Updated holdings for fund:', fundId, 'new value:', inputValue)
    } else {
      console.log('Invalid input for fund:', fundId, 'value:', inputValue)
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
                    <div>
                      <input
                        type="text"
                        value={updatedHoldings[fund.id] ?? ''}
                        onChange={(e) => handleInputChange(fund.id, e.target.value)}
                        style={{
                          width: '120px',
                          padding: '8px 12px',
                          border: `1px solid ${errors[fund.id] ? '#d32f2f' : '#d1d5db'}`,
                          borderRadius: '6px',
                          fontSize: '14px',
                          textAlign: 'right',
                          direction: 'rtl',
                        }}
                        placeholder="הכנס ערך"
                      />
                      {errors[fund.id] && (
                        <p style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>
                          {errors[fund.id]}
                        </p>
                      )}
                    </div>
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

export default FundsWithHoldings
