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
  const { value } = useField()
  const [uploadsData, setUploadsData] = useState<any[]>([])
  const [fileName, setFileName] = useState<string>('')
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
    const interval = setInterval(() => {
      const fileAdjustmentsDiv = document.querySelector(
        '.file-field__file-adjustments',
      ) as HTMLElement | null

      const input = fileAdjustmentsDiv?.querySelector(
        'input.file-field__filename',
      ) as HTMLInputElement | null

      if (fileAdjustmentsDiv && input) {
        clearInterval(interval)

        // הרצת הפונקציה על שם הקובץ
        const fileName = input.value
        const result = parseResearchFilename(fileName)

        // יצירת הספאן
        const span = document.createElement('span')
        span.className = 'filename-info'
        span.style.color = result.isValid ? 'green' : 'red'
        span.style.marginRight = '10px'
        span.style.display = 'block'
        span.style.marginTop = '5px'

        if (!result.isValid) {
          span.textContent = `${result.error}`
        } else if (result.isGeneric) {
          span.textContent = `קובץ כללי`
        } else {
          span.textContent = `קובץ פרטני עבור החברה "${result.companyName}" ונייר ערך "${result.stockName}"`
        }

        fileAdjustmentsDiv.appendChild(span)
        console.log('פלט הפונקציה:', result)
      } else {
        console.log('עדיין לא נמצא האלמנט או הקלט...')
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
