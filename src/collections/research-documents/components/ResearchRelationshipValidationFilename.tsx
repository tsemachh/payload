'use client'

import React, { useEffect, useState } from 'react'
import {
  useField,
  UploadField,
  useAllFormFields,
  useDocumentInfo,
  useForm,
  useFormFields,
  useBulkUpload,
  RelationshipField,
} from '@payloadcms/ui'
import type { ResearchDocument } from '@/payload-types'
import { RelationshipFieldClientProps } from 'payload'
import { getSiblingData } from 'payload/shared'
import { stringify } from 'qs-esm'
import { parseResearchFilename } from '@/utils/parseResearchFilename'

const ResearchRelationshipValidationFilename: React.FC<RelationshipFieldClientProps> = (props) => {
  const { value, setValue } = useField()
  const [uploadsData, setUploadsData] = useState<any[]>([])
  const [fileName, setFileName] = useState<string>('')
  const { value: file } = useField<string>({
    path: `file`,
  })

  const validateFile = async () => {
    const fileAdjustmentsDiv = document.querySelector(
      '.file-field__file-adjustments',
    ) as HTMLElement | null

    const input = fileAdjustmentsDiv?.querySelector(
      'input.file-field__filename',
    ) as HTMLInputElement | null

    if (!fileAdjustmentsDiv || !input?.value) {
      console.log('עדיין לא נמצא האלמנט או שאין ערך בקובץ...')
      return
    }

    const fileName = input.value
    const result = parseResearchFilename(fileName)

    // יצירת או שימוש ב-span קיים
    let span = fileAdjustmentsDiv.querySelector(
      '#research-validation-message',
    ) as HTMLSpanElement | null
    if (!span) {
      span = document.createElement('span')
      span.id = 'research-validation-message'
      span.style.color = 'red'
      span.style.marginRight = '10px'
      fileAdjustmentsDiv.appendChild(span)
    }

    if (!result.isValid) {
      span.textContent = result.error || 'שם הקובץ אינו תקין'
      return
    }

    if (result.isGeneric) {
      span.textContent = `קובץ גנרי עבור כל החברות`
      return
    }

    if (result.companyName) {
      const query = {
        where: {
          name: {
            like: result.companyName,
          },
        },
      }

      const stringified = stringify(query, {
        addQueryPrefix: true,
        encode: false,
      })

      try {
        const res = await fetch(`/api/companies${stringified}`)
        const data = await res.json()

        if (data?.docs?.length > 0) {
          span.textContent = `קובץ פרטני עבור החברה "${result.companyName}" ונייר ערך "${result.stockName}"`
          const companyIds = data.docs.map((doc: any) => doc.id)
          setValue(companyIds)
        } else {
          span.textContent = `החברה "${result.companyName}" לא נמצאה במערכת`
        }
      } catch (err) {
        console.error('שגיאה בבדיקת החברה:', err)
        span.textContent = 'אירעה שגיאה בבדיקת החברה'
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

  return (
    <div>
      <RelationshipField {...props} />
    </div>
  )
}

export default ResearchRelationshipValidationFilename
