'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import { get } from 'react-hook-form'
export type ArrayTabelProps = {
  path: string
}

interface StockItem {
  stockId: string
  accountNum: number
  quantity: number
}

const ArrayTableField: React.FC<ArrayTabelProps> = ({ path }) => {
  const { initialData } = useDocumentInfo()
  const isMeeting = Boolean(initialData?.invitationLink)
  const data = Array.isArray(get(initialData, path)) ? get(initialData, path) : []
  if (data.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-500 text-center py-4">אין נתונים להצגה</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 overflow-hidden shadow-sm ">
      <h3
        className="text-[13px]  text-gray-800 text-right "
        style={{
          fontFamily:
            '-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        נייר ערך מקורי
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {!isMeeting && (
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  נייר ערך
                </th>
              )}
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                כמות
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item: StockItem, index: number) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                {!isMeeting && (
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {item.stockId || '-'}
                  </td>
                )}
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {item.quantity?.toLocaleString() || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
export default ArrayTableField
