'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useField, RelationshipField } from '@payloadcms/ui'
import { RelationshipFieldClientProps } from 'payload'
import { stringify } from 'qs-esm'
import { parseResearchFilename } from '@/utils/parseResearchFilename'
import { useCustomContext } from '@/providers/CustomContext'

const ResearchRelationshipValidationFilename: React.FC<RelationshipFieldClientProps> = (props) => {
  const { value, setValue } = useField<string[]>()
  const { value: file } = useField<string>({
    path: `file`,
  })
  const { meetingCompanies, stockId } = useCustomContext()

  const prevValueRef = useRef<string[]>([])

  const validateFile = async () => {
    const fileAdjustmentsDiv = document.querySelector(
      '.file-field__file-adjustments',
    ) as HTMLElement | null

    const input = fileAdjustmentsDiv?.querySelector(
      'input.file-field__filename',
    ) as HTMLInputElement | null

    if (!fileAdjustmentsDiv || !input?.value) {
      return
    }

    // יצירת או שימוש ב-span קיים
    let span = fileAdjustmentsDiv.querySelector(
      '#research-validation-message',
    ) as HTMLSpanElement | null
    if (!span) {
      span = document.createElement('span')
      span.id = 'research-validation-message'
      span.style.marginRight = '10px'
      fileAdjustmentsDiv.appendChild(span)
    }

    const setSpanMessage = (text: string, isSuccess = false) => {
      span!.textContent = text
      span!.style.color = isSuccess ? 'green' : 'red'
    }

    const fileName = input.value
    const result = parseResearchFilename(fileName)

    if (!result.isValid) {
      setSpanMessage(result.error || 'שם הקובץ אינו תקין')
      return
    }

    let stockNameFromMatch = false

    if (result.stockName) {
      try {
        console.log('---- ???id', stockId)
        const res = await fetch(`/api/stocks/${stockId}`)
        const doc = await res.json()
        const resultStockName = doc?.name || ''

        if (resultStockName === result.stockName) {
          stockNameFromMatch = true
        }
      } catch (err) {
        console.error('שגיאה בבדיקת נייר הערך:', err)
        setSpanMessage('אירעה שגיאה בבדיקת נייר הערך')
        return
      }
    }
    if (result.isGeneric && result.stockName && result.companyName && stockNameFromMatch) {
      // קובץ כללי ללא נייר ערך או חברה
      setSpanMessage(`קובץ כללי עבור כל החברות`, true)
      return
    } else if (result.isGeneric) {
      setSpanMessage(`קובץ כללי אך נייר הערך "${result.stockName}" לא באסיפה`)
      return
    }

    if (result.companyName) {
      const query = {
        where: {
          and: [
            {
              name: {
                like: result.companyName,
              },
            },
            {
              id: {
                in: meetingCompanies,
              },
            },
          ],
        },
        limit: 0,
      }

      const stringified = stringify(query, {
        addQueryPrefix: true,
        encode: false,
      })

      try {
        const res = await fetch(`/api/companies${stringified}`)
        const data = await res.json()

        if (data?.docs?.length > 0 && stockNameFromMatch) {
          setSpanMessage(
            `קובץ פרטני עבור החברה "${result.companyName}" ונייר ערך "${result.stockName}"`,
            true,
          )
          const companyIds = data.docs.map((doc: any) => doc.id)
          setValue(Array.from(companyIds))
        } else if (data?.docs?.length > 0) {
          setSpanMessage(
            `החברה "${result.companyName}" נמצאה, אך נייר הערך "${result.stockName}" לא באסיפה`,
          )
        } else if (stockNameFromMatch) {
          setSpanMessage(
            `נייר הערך "${result.stockName}" נמצא, אך החברה "${result.companyName}" לא משתתפת באסיפה זו`,
          )
        } else {
          setSpanMessage(
            `החברה "${result.companyName}" לא משתתפת באסיפה זו וגם נייר הערך "${result.stockName}" לא באסיפה`,
          )
        }
      } catch (err) {
        console.error('שגיאה בבדיקת החברה:', err)
        setSpanMessage('אירעה שגיאה בבדיקת החברה')
      }
    }
  }

  useEffect(() => {
    const start = Date.now()

    const interval = setInterval(() => {
      const fileAdjustmentsDiv = document.querySelector('.file-field__file-adjustments')
      const input = fileAdjustmentsDiv?.querySelector(
        'input.file-field__filename',
      ) as HTMLInputElement | null

      if (fileAdjustmentsDiv && input?.value) {
        clearInterval(interval)
        validateFile()
      }

      // הפסקה בטיחותית אחרי 5 שניות
      if (Date.now() - start >= 5000) {
        clearInterval(interval)
      }
    }, 1000) // בודק כל שנייה

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    validateFile()
  }, [file])

  useEffect(() => {
    if (!Array.isArray(value)) return

    prevValueRef.current = value
  }, [value])

  return (
    <div>
      <RelationshipField {...props} />
    </div>
  )
}

export default ResearchRelationshipValidationFilename
