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
  //const filename1 = useFormFields(([fields, dispatch]) => fields.filename)

  // const { form } = useForm()
  // const { formFields } = useFormFields()
  // useEffect(() => {
  //   console.log('🔍 useEffect התחיל – מחפש .file-field__filename')

  //   const fileInputs = document.querySelectorAll('.file-field__filename')
  //   console.log(`📄 נמצאו ${fileInputs.length} קבצים`)

  //   fileInputs.forEach((inputEl, index) => {
  //     console.log(`➡️ קובץ ${index + 1}:`, inputEl)

  //     const parentDiv = inputEl.parentElement
  //     if (!parentDiv) {
  //       console.warn(`⚠️ לקובץ ${index + 1} אין אלמנט אב`)
  //       return
  //     }

  //     // בדיקה אם כבר הוספנו span כדי לא לשכפל
  //     if (parentDiv.querySelector('.test-span')) {
  //       console.log(`ℹ️ כבר קיים test-span עבור קובץ ${index + 1}`)
  //       return
  //     }

  //     const testSpan = document.createElement('span')
  //     testSpan.className = 'test-span'
  //     testSpan.textContent = '👀 הצלחתי לגשת!'
  //     testSpan.style.color = 'green'
  //     testSpan.style.marginLeft = '10px'

  //     parentDiv.appendChild(testSpan)
  //     console.log(`✅ הוספתי טקסט ליד קובץ ${index + 1}`)
  //   })

  //   console.log('🏁 useEffect הסתיים')
  // }, [])
  useEffect(() => {
    const interval = setInterval(async () => {
      const fileAdjustmentsDiv = document.querySelector(
        '.file-field__file-adjustments',
      ) as HTMLElement | null

      const input = fileAdjustmentsDiv?.querySelector(
        'input.file-field__filename',
      ) as HTMLInputElement | null

      if (fileAdjustmentsDiv && input && input.value) {
        const fileName = input.value
        const result = parseResearchFilename(fileName)

        const span = document.createElement('span')
        span.style.color = 'red'
        span.style.marginRight = '10px'

        if (!result.isValid) {
          span.textContent = result.error || 'שם הקובץ אינו תקין'
          fileAdjustmentsDiv.appendChild(span)
          clearInterval(interval)
          return
        }

        if (result.isGeneric) {
          span.textContent = `קובץ גנרי עבור כל החברות`
          fileAdjustmentsDiv.appendChild(span)
          clearInterval(interval)
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

          fileAdjustmentsDiv.appendChild(span)
          clearInterval(interval)
        }
      } else {
        console.log('עדיין לא נמצא האלמנט או שאין ערך בקובץ...')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <RelationshipField {...props} />
    </div>
  )
}

export default ResearchRelationshipValidationFilename
