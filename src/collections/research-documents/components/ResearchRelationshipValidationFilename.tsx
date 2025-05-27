'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useField, RelationshipField } from '@payloadcms/ui'
import { RelationshipFieldClientProps } from 'payload'
import { stringify } from 'qs-esm'
import { parseResearchFilename } from '@/utils/parseResearchFilename'
import { getSubtreeExcludingLeaves } from '@/utils/getSubCompanies'

const ResearchRelationshipValidationFilename: React.FC<RelationshipFieldClientProps> = (props) => {
  const { value, setValue } = useField<string[]>()
  const { value: file } = useField<string>({
    path: `file`,
  })
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
        limit: 0, // או כל מספר אחר שתצטרכי
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
          // console.log('----==== 111', companyIds)
          const companyIdsSubTree = await getSubtreeExcludingLeaves({ ids: companyIds })

          // console.log('----==== companyIdsSubTree', companyIdsSubTree)

          setValue(Array.from(companyIds))
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

  useEffect(() => {
    if (!Array.isArray(value)) return

    const prevValue = prevValueRef.current
    const added = value.filter((id) => !prevValue.includes(id))

    if (added.length > 0) {
      // console.log('----==== added', added)

      getSubtreeExcludingLeaves({ ids: added }).then((companyIdsSubTree) => {
        // console.log('----==== companyIdsSubTree', companyIdsSubTree)

        // Combine existing + new IDs from subtree (no duplicates)
        const newSet = new Set([...value, ...companyIdsSubTree])
        setValue(Array.from(newSet))
      })
    }

    prevValueRef.current = value
  }, [value])

  return (
    <div>
      <RelationshipField {...props} />
    </div>
  )
}

export default ResearchRelationshipValidationFilename
