'use client'

import React, { useEffect } from 'react'
import { useField,UploadField,useAllFormFields,useDocumentInfo, useForm, useFormFields ,useBulkUpload } from '@payloadcms/ui'
import type { ResearchDocument } from '@/payload-types'
import { UploadFieldClientProps } from 'payload'
import { getSiblingData } from 'payload/shared'

const ResearchUploadDisplay: React.FC<UploadFieldClientProps>  = (props) => {
    //console.log('-----------------------propssssss',props)
    //const { setCollectionSlug, setCurrentActivePath, setOnSuccess } = useBulkUpload()

   const { value, setValue } = useField() 
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
useEffect(() => {
  console.log('-----------------------111')

  const filenameEl = document.querySelector('.upload-relationship-details__details')
  console.log('-----------------------filenameEl',filenameEl)

  if (filenameEl && !document.querySelector('.withMeta-span')) {
    const newSpan = document.createElement('p')
    newSpan.textContent = 'efrat'
    newSpan.className = 'withMeta-span'
    newSpan.style.marginLeft = '8px'

    filenameEl.parentNode?.appendChild(newSpan)
  }
}, [value])
//props=...withMeta=true
  return (
    <div ><UploadField {...props} />
    </div>
  )
}

export default ResearchUploadDisplay
