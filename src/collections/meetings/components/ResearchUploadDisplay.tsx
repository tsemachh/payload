'use client'

import React, { useEffect, useState } from 'react'
import { useField,UploadField,useAllFormFields,useDocumentInfo, useForm, useFormFields ,useBulkUpload } from '@payloadcms/ui'
import type { ResearchDocument } from '@/payload-types'
import { UploadFieldClientProps } from 'payload'
import { getSiblingData } from 'payload/shared'
import { stringify } from 'qs-esm'

const ResearchUploadDisplay: React.FC<UploadFieldClientProps>  = (props) => {
   const { value } = useField() 
   const [uploadsData, setUploadsData] = useState<any[]>([]);

 useEffect(() => {
  const getAllUploads = async () => {
    if (!value || !Array.isArray(value) || value.length === 0) return;

    const ids = value.map((v: any) => (typeof v === 'object' ? v.id : v));
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
      },
    };
    
    const stringifiedQuery = stringify(query, { addQueryPrefix: true })  
    try {
      const res = await fetch(`/api/research-documents${stringifiedQuery}`);
      const { docs } = await res.json();

      const uploadsMap = new Map(docs.map((doc: any) => [doc.id, doc]));
      const sortedDocs = ids.map(id => uploadsMap.get(id)).filter(Boolean);
      setUploadsData(sortedDocs);
    } catch (err) {
      console.error('Failed to fetch uploads', err);
    }
  };

  getAllUploads();
}, [value]);

useEffect(() => {
  const interval = setInterval(() => {
    if (!uploadsData || uploadsData.length === 0) return;

    const filenameEls = document.querySelectorAll('.upload-relationship-details__details');

    filenameEls.forEach((el, i) => {
      const upload = uploadsData[i];
      if (!upload) return;

      const companyNames = (upload.companies || []).map((c: any) => c?.name).filter(Boolean);

      if (!el.querySelector('.withMeta-span') && companyNames.length > 0) {
        const newSpan = document.createElement('p');
        newSpan.className = 'withMeta-span';
        newSpan.style.marginLeft = '8px';
        newSpan.textContent = companyNames.join(', ');
        el.appendChild(newSpan);
      }
    });
  }, 1000);

  return () => clearInterval(interval);
}, [uploadsData]);


  return (
    <div ><UploadField {...props} />
    </div>
  )
}

export default ResearchUploadDisplay
