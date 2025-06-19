'use client'

import React, { useEffect, useState } from 'react'
import { useField, UploadField, useDocumentInfo } from '@payloadcms/ui'
import { UploadFieldClientProps } from 'payload'
import { stringify } from 'qs-esm'
import { useCustomContext } from '@/providers/CustomContext'
import { parseResearchFilename } from '@/utils/parseResearchFilename'

const ResearchUploadDisplay: React.FC<UploadFieldClientProps> = (props) => {
  const { value } = useField()
  const [uploadsData, setUploadsData] = useState<any[]>([])
  const { setMeetingCompanies, setStockId } = useCustomContext()
  const documentInfo = useDocumentInfo()

  const fetchCompanyIsRegular = async (companyName: string): Promise<boolean> => {
    const query = {
      where: {
        name: { like: companyName },
        type: { equals: 'regular' },
      },
      limit: 1,
      depth: 0,
      select: {
        id: true,
      },
    }

    const stringifiedQuery = stringify(query, { addQueryPrefix: true })
    const res = await fetch(`/api/companies${stringifiedQuery}`)
    if (!res.ok) return false
    const data = await res.json()
    return data?.docs?.length > 0
  }

  useEffect(() => {
    const companies = documentInfo.initialData?.companies || []
    const stock = documentInfo.initialData?.stock || []
    if (companies) {
      setMeetingCompanies(companies)
    }
    if (stock) {
      setStockId(stock)
    }
    const chooseExistingBtn = document.querySelector('.upload__listToggler')
    if (chooseExistingBtn) {
      ;(chooseExistingBtn as HTMLElement).style.display = 'none'
    }

    const orText = document.querySelector('.upload__dropzoneContent__orText')
    if (orText) {
      ;(orText as HTMLElement).style.display = 'none'
    }
  }, [])

  useEffect(() => {
    const getAllUploads = async () => {
      if (!value || !Array.isArray(value) || value.length === 0) return

      const ids = value.map((v: any) => (typeof v === 'object' ? v.id : v))
      const query = {
        where: {
          id: {
            in: ids,
          },
        },
        depth: 1,
        limit: 0,
        select: {
          companies: true,
          filename: true,
        },
      }

      const stringifiedQuery = stringify(query, { addQueryPrefix: true })
      try {
        const res = await fetch(`/api/research-documents${stringifiedQuery}`)
        const { docs } = await res.json()
        const uploadsMap = new Map(docs.map((doc: any) => [doc.id, doc]))
        const sortedDocs = ids.map((id) => uploadsMap.get(id)).filter(Boolean)
        setUploadsData(sortedDocs)
      } catch (err) {
        console.error('Failed to fetch uploads', err)
      }
    }

    getAllUploads()
  }, [value])

  useEffect(() => {
    if (!uploadsData || uploadsData.length === 0) return

    const updateFilenames = async () => {
      const filenameEls = document.querySelectorAll('.upload-relationship-details__details')

      for (const [i, el] of Array.from(filenameEls).entries()) {
        const upload = uploadsData[i]
        if (!upload) continue

        el.querySelectorAll('.withMeta-span').forEach((span) => span.remove())

        const companyNames = (upload.companies || []).map((c: any) => c?.name).filter(Boolean)
        const result = parseResearchFilename(upload.filename)

        if (!el.querySelector('.withMeta-span')) {
          const newSpan = document.createElement('p')
          newSpan.className = 'withMeta-span'

          const companyExists = await fetchCompanyIsRegular(result.companyName || '')
          newSpan.textContent =
            !result.isGeneric && result.companyName && companyNames.length === 0 && !companyExists
              ? 'מסמך לחברה לא קיימת'
              : companyNames.length > 0
                ? companyNames.join(', ')
                : 'מסמך מחקר כללי'

          newSpan.style.marginLeft = '8px'
          newSpan.style.fontFamily = 'Arial, sans-serif'
          newSpan.style.fontStyle = 'italic'

          el.appendChild(newSpan)
        }
      }
    }

    updateFilenames().catch((err) => console.error('Error updating filenames:', err))
  }, [uploadsData])

  return (
    <div>
      <UploadField {...props} />
    </div>
  )
}

export default ResearchUploadDisplay
