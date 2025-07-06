'use client'
import React from 'react'
import { RelationshipField } from '@payloadcms/ui'
import { RelationshipFieldClientComponent } from 'payload'

const CompaniesRelationshipField: RelationshipFieldClientComponent = (props) => {
  return (
    <>
      aaaaaaabbbbb
      <RelationshipField {...props} />
    </>
  )
}
export default CompaniesRelationshipField

// import type React from 'react'
// import { RelationshipField } from '@payloadcms/ui'
// import type { RelationshipFieldServerComponent } from 'payload'

// const CustomRelationshipFieldServer: RelationshipFieldServerComponent = ({
//   clientField,
//   path,
//   schemaPath,
//   permissions,
// }) => {
//   console.log('aaa')

//   return (
//     <>
//       aaaaaaa
//       <RelationshipField
//         field={clientField}
//         path={path}
//         schemaPath={schemaPath}
//         permissions={permissions}
//       />
//     </>
//   )
// }
// export default CustomRelationshipFieldServer
