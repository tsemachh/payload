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
            initialErrors[fund.id] = null
          } else {
            initialErrors[fund.id] = null
          }
        })
        setUpdatedHoldings(initialUpdatedHoldings)
        setErrors(initialErrors)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('שגיאה בטעינת נתונים')
      } finally {
        setLoading(false)
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
    setValue(newValue)
  }, [funds, updatedHoldings])

  const handleCheckboxChange = (fundId: string, state: CheckboxFilterState) => {
    setFunds((prev) =>
      prev.map((fund) => (fund.id === fundId ? { ...fund, isAuthorized: state } : fund)),
    )

    if (state !== 'unchecked') {
      setUpdatedHoldings((prev) => {
        const newHoldings = { ...prev }
        delete newHoldings[fundId]
        return newHoldings
      })
      setErrors((prev) => {
        const newErrors = { ...prev, [fundId]: null }
        return newErrors
      })
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev, [fundId]: null }
        return newErrors
      })
    }
  }

  const handleInputChange = (fundId: string, inputValue: string) => {
    if (inputValue === '' || /^-?\d*\.?\d*$/.test(inputValue)) {
      setUpdatedHoldings((prev) => ({
        ...prev,
        [fundId]: inputValue,
      }))
      setErrors((prev) => ({
        ...prev,
        [fundId]: null,
      }))
    }
  }

  return (
    <div className="my-5 p-2.5">
      {loading && <p className="text-gray-600">טוען נתונים...</p>}

      {error && <p className="text-red-600">{error}</p>}

      {funds.length === 0 && !loading && !error && (
        <p className="text-gray-600">אין תיקים זמינים להצגה</p>
      )}

      {funds.length > 0 && (
        <div className="w-full max-w-4xl overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-200 border-b border-gray-200">
                <th className="px-6 py-6 text-right text-base font-semibold text-gray-500">
                  שם תיק
                </th>
                <th className="px-6 py-6 text-right text-base font-semibold text-gray-500">
                  ערך נקוב במערכת
                </th>
                <th className="px-6 py-6 text-right text-base font-semibold text-gray-500">
                  אימות אחזקות
                </th>
                <th className="px-6 py-6 text-right text-base font-semibold text-gray-500">
                  ערך נקוב ברשות
                </th>
              </tr>
            </thead>
            <tbody>
              {funds.map((fund, index) => (
                <tr
                  key={fund.id}
                  className={`
  border-b border-gray-100 transition-colors duration-200 h-20
  ${index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-200 hover:bg-gray-250'}
`}
                >
                  <td className="px-6 py-6 text-base text-gray-900 font-medium align-top">
                    {fund.name}
                  </td>
                  <td className="px-6 py-6 text-base text-gray-700 align-top">
                    {fund.quantity.toLocaleString()}
                  </td>
                  <td className="px-6 py-6 align-top min-w-[150px]">
                    <CheckboxFilter
                      value={fund.isAuthorized}
                      onChange={(state) => handleCheckboxChange(fund.id, state)}
                    />
                  </td>
                  <td className="w-48 p-0 text-center align-middle">
                    {fund.isAuthorized === 'unchecked' && (
                      <div>
                        <input
                          type="text"
                          value={updatedHoldings[fund.id] ?? ''}
                          onChange={(e) => handleInputChange(fund.id, e.target.value)}
                          className={`
    mx-auto w-32 px-2 py-1 text-base text-right border rounded-md
    focus:outline-none focus:ring-2
    ${!updatedHoldings[fund.id] ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
  `}
                          placeholder="הכנס ערך"
                          dir="rtl"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default FundsWithHoldings
