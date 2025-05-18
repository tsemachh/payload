'use client'

import React from 'react'
import { useField,UploadField,useAllFormFields,useForm } from '@payloadcms/ui'
import type { ResearchDocument } from '@/payload-types'
import { UploadFieldClientProps } from 'payload'

type Props = {
  path: string
}

const ResearchUploadDisplay: React.FC<UploadFieldClientProps>  = (props) => {
    console.log('-----------------------props',props)

    
  const { value } = useField<string>({ path: 'upload' })
  const a= useForm

  console.log('-----------------------value',value)
  console.log('-----------------------a',a)

//   console.log('-----------[ResearchUploadDisplay] raw value:', value)

//   // הערך יכול להיות אחד מ-2: מערך של מחרוזות (ids) או מערך של אובייקטים (documents)
//   const documents = Array.isArray(value)
//     ? value.filter(Boolean).map((item) => (typeof item === 'object' ? item : null)).filter(Boolean)
//     : []
//console.log('-----------[ResearchUploadDisplay] raw documents:', documents)

  return (
    <div ><UploadField {...props} />
</div>
    // <div className="flex flex-col gap-4 mt-2">
    //   {documents.length > 0 ? (
    //     documents.map((doc: any) => (
    //       <div key={doc.id || doc.filename} className="border p-3 rounded-md bg-gray-100 text-sm leading-6">
    //         <div><strong>שם קובץ:</strong> {doc.filename || 'ללא שם'}</div>
    //         <div className="flex flex-wrap">
    //           <strong className="mr-1">חברות:</strong>
    //           {Array.isArray(doc.company) && doc.company.length > 0 ? (
    //             <span>
    //               {doc.company
    //                 .map((c: { name: any }) => (typeof c === 'object' ? c.name : c))
    //                 .join(', ')}
    //             </span>
    //           ) : (
    //             <span>ללא חברות</span>
    //           )}
    //         </div>
    //       </div>
    //     ))
    //   ) : (
    //     <div className="text-gray-500">לא נבחרו מסמכים</div>
    //   )}
    // </div>
  )
}

export default ResearchUploadDisplay
