'use client'
import React from 'react'
import { TextField, useField } from '@payloadcms/ui'
import { TextFieldClientProps } from 'payload'
import { IconLinkProps } from './IconLinkProps'

/**
 * Props for the IconLink Field component
 * Extends IconLinkProps with TextFieldClientProps
 */
export type IconLinkFieldProps = IconLinkProps & TextFieldClientProps

/**
 * Field component for displaying text with an optional icon link in PayloadCMS forms
 * @param props - Props combining IconLinkProps and TextFieldClientProps
 * @returns React component
 */
const IconLinkTextField: React.FC<IconLinkFieldProps> = (props) => {
  const {
    path,
    urlTemplate,
    iconUrl,
    iconOnly,
    iconAltText,
    visibilityConditions,
    ...remainingProps
  } = props

  // Main field value
  const { value } = useField<string>({ path: path })

  // Get all condition field values at the top level instead of inside reduce
  const conditionFieldValues: Record<string, any> = {}

  // Extract all field names from visibilityConditions
  const conditionFields = visibilityConditions ? Object.keys(visibilityConditions) : []

  // Call useField for each condition field at the top level
  conditionFields.forEach((fieldName) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { value: fieldValue } = useField<any>({ path: fieldName })
    conditionFieldValues[fieldName] = fieldValue
  })

  // Derive the link value
  const linkValue = urlTemplate.replace('${value}', value || '')

  // Evaluate visibility using the already collected values
  const isVisible = React.useMemo(() => {
    if (!value) return false
    if (!visibilityConditions) return true
    return Object.entries(visibilityConditions).every(
      ([field, expectedValue]) => conditionFieldValues[field] === expectedValue,
    )
  }, [value, conditionFieldValues, visibilityConditions])

  return (
    <div className="inline-flex items-center">
      <span className={`flex-grow mr-2 relative ${iconOnly ? 'w-[699px]' : ''}`}>
        <TextField {...remainingProps} path={path} />
        {isVisible && (
          <a
            href={linkValue}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-[32px] left-[9px] w-[26px] h-[26px] flex items-center justify-center bg-white rounded-full border border-gray-300 shadow-sm cursor-pointer"
            title={linkValue}
            onClick={(e) => {
              // Prevent PayloadCMS form navigation warning
              e.stopPropagation()
            }}
          >
            <img src={iconUrl} alt={iconAltText} className="" />
          </a>
        )}
      </span>
    </div>
  )
}

export default IconLinkTextField
