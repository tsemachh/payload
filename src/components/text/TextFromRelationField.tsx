// 'use client'
// import { TextField, useField, useFormInitializing } from '@payloadcms/ui'
// import { TextFieldClientProps } from 'payload'
// import { useEffect } from 'react'
// import { useSelectionContext } from '@/providers/SelectionContext'

// export interface TextFromRelationFieldProps {
//   relationField: string
//   relationDisplayField: string
//   fetchEndpoint: string
//   inlineBlock: boolean
// }

// const TextFromRelationField: React.FC<TextFromRelationFieldProps & TextFieldClientProps> = (
//   props,
// ) => {
//   const { relationField, relationDisplayField, fetchEndpoint, inlineBlock = false, path } = props
//   const formInitializing = useFormInitializing()
//   const { blockText, setBlockText } = useSelectionContext()

//   const { value, setValue } = useField<string>({
//     path: `${path}`,
//   })

//   const { value: relationValue } = useField<string>({
//     path: `${relationField}`,
//   })

//   useEffect(() => {
//     const fetchData = async () => {
//       if (formInitializing) {
//         return
//       }

//       if (relationValue) {
//         if (inlineBlock && blockText != '') {
//           setValue(blockText)
//           setBlockText('')
//           return
//         }
//         const response = await fetch(`${fetchEndpoint}/${relationValue}?depth=0`)
//         if (!response.ok) {
//           throw new Error('Network response was not ok')
//         }
//         const data = await response.json()
//         if (data && data[relationDisplayField] !== value) {
//           setValue(data[relationDisplayField] || '')
//         } else {
//           console.log('No data returned')
//         }
//       }
//     }
//     fetchData()
//   }, [relationValue])
//   return <TextField {...props} />
// }

// export default TextFromRelationField
