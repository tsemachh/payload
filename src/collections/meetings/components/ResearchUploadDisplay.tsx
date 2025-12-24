'use client'

import React, { useEffect, useState } from 'react'
import { useField, UploadField, useDocumentInfo } from '@payloadcms/ui'
import { UploadFieldClientProps } from 'payload'
import { stringify } from 'qs-esm'
import { useCustomContext } from '@/providers/CustomContext'
import { parseResearchFilename } from '@/utils/parseResearchFilename'
import ResearchDocumentsView from './ResearchDocumentsView'

const ResearchUploadDisplay: React.FC<UploadFieldClientProps> = (props) => {
  const { value } = useField()
  const [uploadsData, setUploadsData] = useState<any[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
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

    const res = await fetch(`/api/companies${stringify(query, { addQueryPrefix: true })}`)
    if (!res.ok) return false
    const data = await res.json()
    return data?.docs?.length > 0
  }

  /**
   * init context + hide unused upload UI parts
   */
  useEffect(() => {
    const companies = documentInfo.initialData?.companies || []
    const stock = documentInfo.initialData?.stock || []

    setMeetingCompanies(companies)
    setStockId(stock)

    const chooseExistingBtn = document.querySelector('.upload__listToggler')
    if (chooseExistingBtn) {
      ;(chooseExistingBtn as HTMLElement).style.display = 'none'
    }

    const orText = document.querySelector('.upload__dropzoneContent__orText')
    if (orText) {
      ;(orText as HTMLElement).style.display = 'none'
    }
  }, [documentInfo.initialData])

  /**
   * fetch research documents when value changes
   */
  useEffect(() => {
    const getAllUploads = async () => {
      if (!Array.isArray(value) || value.length === 0) return

      const ids = value.map((v: any) => (typeof v === 'object' ? v.id : v))
      const query = {
        where: { id: { in: ids } },
        depth: 1,
        limit: 0,
        select: { companies: true, filename: true },
      }

      try {
        const res = await fetch(`/api/research-documents${stringify(query, { addQueryPrefix: true })}`)
        const { docs } = await res.json()

        const uploadsMap = new Map(docs.map((doc: any) => [doc.id, doc]))
        setUploadsData(ids.map((id) => uploadsMap.get(id)).filter(Boolean))
      } catch (err) {
        console.error('Failed to fetch uploads', err)
      }
    }

    getAllUploads()
    setRefreshTrigger((prev) => prev + 1)
  }, [value])

  /**
   * enrich upload list UI (filename metadata)
   */
  useEffect(() => {
    if (!uploadsData.length) return

    const updateFilenames = async () => {
      const filenameEls = document.querySelectorAll('.upload-relationship-details__details')

      for (const [i, el] of Array.from(filenameEls).entries()) {
        const upload = uploadsData[i]
        if (!upload) continue

        el.querySelectorAll('.withMeta-span').forEach((span) => span.remove())

        const companyNames = (upload.companies || []).map((c: any) => c?.name).filter(Boolean)
        const result = parseResearchFilename(upload.filename)
        const companyExists = await fetchCompanyIsRegular(result.companyName || '')

        const metaText =
          !result.isGeneric && result.companyName && companyNames.length === 0 && !companyExists
            ? 'מסמך לחברה לא קיימת'
            : companyNames.length > 0
              ? companyNames.join(', ')
              : 'מסמך מחקר כללי'

        const meta = document.createElement('p')
        meta.className = 'withMeta-span'
        meta.textContent = metaText
        meta.style.marginLeft = '8px'
        meta.style.fontFamily = 'Arial, sans-serif'
        meta.style.fontStyle = 'italic'

        el.appendChild(meta)
      }
    }

    updateFilenames().catch(console.error)
  }, [uploadsData])

  return (
    <div className="space-y-6">
      <UploadField {...props} />

      {documentInfo.id && (
        <div className="mt-8">
          <ResearchDocumentsView refreshTrigger={refreshTrigger} />
        </div>
      )}
    </div>
  )
}

export default ResearchUploadDisplay
