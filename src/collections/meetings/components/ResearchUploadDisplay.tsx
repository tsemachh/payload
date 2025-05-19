'use client'

import React, { useEffect, useState } from 'react'
import { useField,UploadField,useAllFormFields,useDocumentInfo, useForm, useFormFields ,useBulkUpload } from '@payloadcms/ui'
import type { ResearchDocument } from '@/payload-types'
import { UploadFieldClientProps } from 'payload'
import { getSiblingData } from 'payload/shared'

const ResearchUploadDisplay: React.FC<UploadFieldClientProps>  = (props) => {
    //console.log('-----------------------propssssss',props)
    //const { setCollectionSlug, setCurrentActivePath, setOnSuccess } = useBulkUpload()

   const { value, setValue } = useField() 
   const [uploadsData, setUploadsData] = useState<any[]>([]);

    const {isEditing, initialData, savedDocumentData} = useDocumentInfo()
    //const [fields, dispatchFields] = useAllFormFields()
    //const fieldData = getSiblingData(fields, 'file')
    //const fileName = (value as unknown as File).name
    //console.log('-----------------------@@@@@@@fileName',fileName)

  //const { value,setValue } = useField<string>()
  //const a= useForm()

  //console.log('-----------------------a',a)
  console.log('-----------------------isEditing',isEditing)

  console.log('-----------------------initialData',initialData)

  //console.log('-----------------------fields',fields)
  console.log('-----------------------savedDocumentData',savedDocumentData)
  //console.log('-----------------------dispatchFields',dispatchFields)
  //console.log('-----------------------fieldData',fieldData)
//   const baseClass = 'upload-relationship-details__filename'
//   <div className={`${baseClass}__details`}>
//   <p className={`${baseClass}__filename`}>
//     {src ? (
//       <a href={src} target="_blank">
//         {filename}
//       </a>
//     ) : (
//       filename
//     )}
//   </p>
//   {withMeta ? <p className={`${baseClass}__meta`}>{metaText}</p> : null}
// </div>
//query run om value adjust one one:
//query all - 
 // שלב 1: הבאת הקבצים מהשרת
 useEffect(() => {
  const getAllUploads = async () => {
    if (!value || !Array.isArray(value) || value.length === 0) return;

    const ids = value.map((v: any) => (typeof v === 'object' ? v.id : v));
    const idsQuery = ids.map((id: string) => `id[in][]=${id}`).join('&');
//יש צורך לפרק במפ או משהו כמה חברות יש בכל מסמך ואז כשנרוץ נדע כמה לתת ולמי... יכול להיות למסמך הראשון 3 ולשני 2 וכן הלאה
    try {
      const res = await fetch(`/api/research-documents?${idsQuery}&depth=1`);
      const data = await res.json();
      console.log("------data",data)
      console.log("------data.docs",data.docs)

      setUploadsData(data.docs);
    } catch (err) {
      console.error('Failed to fetch uploads', err);
    }
  };

  getAllUploads();
}, [value]);

// שלב 2: הוספת שמות החברות ל-DOM כל שנייה
useEffect(() => {
  const interval = setInterval(() => {
    if (!uploadsData || uploadsData.length === 0) return;

    const filenameEls = document.querySelectorAll('.upload-relationship-details__details');

    filenameEls.forEach((el, i) => {
      const upload = uploadsData[i];
      if (!upload) return;

      const companies = upload?.companies || []; // שנה את זה בהתאם לשם השדה אצלך
      const companyNames = companies.map((c: any) => c?.name || '').filter(Boolean);

      if (!el.querySelector('.withMeta-span') && companyNames.length > 0) {
        const newSpan = document.createElement('p');
        newSpan.className = 'withMeta-span';
        newSpan.style.marginLeft = '8px';
        newSpan.textContent = `חברות: ${companyNames.join(', ')}`;
        el.appendChild(newSpan);
      }
    });
  }, 1000); // כל שנייה

  return () => clearInterval(interval);
}, [uploadsData]);


//props=...withMeta=true
  return (
    <div ><UploadField {...props} />
    </div>
  )
}

export default ResearchUploadDisplay
