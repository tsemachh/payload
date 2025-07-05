'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useConfig, useListQuery, useTranslation } from '@payloadcms/ui'
import { DateFilter } from '@/plugins/filter/filters/components/date-filter'
import { SelectFilter } from '@/plugins/filter/filters/components/select-filter'
import { CheckboxFilter } from '@/plugins/filter/filters/components/checkbox-filter'
import type {
  CheckboxFilterState,
  DateFilterValue,
  Locale,
  SelectFilterValue,
} from '@/types/filter-types'
import { ClientField, FieldAffectingData, type SelectField } from 'payload'
import { getTranslation } from '@payloadcms/translations'
import { SmallSelectFilter } from '@/plugins/filter/filters/components/small-select-filter'

// Recursive function to find fields by name
function findFieldsByName(fields: ClientField[], fieldNames: string[]): ClientField[] {
  const results: ClientField[] = []

  function recursiveSearch(fields: ClientField[]) {
    const filteredFields = fields.filter(
      (field) => 'name' in field && fieldNames.includes(field.name as string),
    )
    results.push(...filteredFields)

    fields.forEach((item) => {
      if (
        (item.type === 'array' || item.type === 'row' || item.type === 'collapsible') &&
        'fields' in item &&
        Array.isArray(item.fields)
      ) {
        recursiveSearch(item.fields)
      }
      if (item.type === 'tabs' && 'tabs' in item && Array.isArray(item.tabs)) {
        item.tabs.forEach((tab) => {
          if ('fields' in tab && Array.isArray(tab.fields)) {
            recursiveSearch(tab.fields)
          }
        })
      }
      if (item.type === 'blocks' && 'blocks' in item && Array.isArray(item.blocks)) {
        item.blocks.forEach((block) => {
          if ('fields' in block && Array.isArray(block.fields)) {
            recursiveSearch(block.fields)
          }
        })
      }
    })
  }

  recursiveSearch(fields)

  return results
}

const DirectFilter = ({ slug, filterList }: { slug: string; filterList: string[] }) => {
  const [fields, setFields] = useState<any[]>([])
  const { refineListData } = useListQuery()
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const [locale, setLocale] = useState<Locale>({ code: 'he', direction: 'rtl' })
  const { getEntityConfig } = useConfig()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    // Now you can access any property from the collection configuration
    const collection = getEntityConfig({ collectionSlug: slug }) // The collection slug
    // Get the fields from the collection's custom.filterList
    // Use the global findFieldsByName function defined at the top of the file
    const fields = findFieldsByName(collection?.fields, filterList as string[])
    //Extract only name label type options from fields
    const simplifiedFields = fields.map((field) => {
      const label = (field as FieldAffectingData).label
      // Get the translation utilities

      // If you have a label defined as a string or object with locale keys
      const translatedLabel = getTranslation(label as string, i18n)

      return {
        name: (field as FieldAffectingData).name,
        label: translatedLabel,
        type: field.type,
        options: (field as SelectField).options,
      }
    })

    // Sort the simplified fields to match the order in filterList
    const sortedFields = (filterList as string[])
      .map((fieldName) => simplifiedFields.find((field) => field.name === fieldName))
      .filter(Boolean)

    setFields(sortedFields)
  }, [])

  // This function will be called by each filter component when its value changes
  const updateFilterValue = useCallback((fieldName: string, value: any) => {
    setFilterValues((prev) => ({ ...prev, [fieldName]: value }))
  }, [])

  // Use useEffect to handle the side effect of calling refineListData
  useEffect(() => {
    // Only run if we have actual filter values to apply
    const hasFilters = Object.values(filterValues).some((val) => val !== undefined)

    if (!hasFilters) {
      refineListData({ where: {} }, true)
    }

    // Apply all filters at once
    const where: Record<string, any> = {}

    // Build the where clause from all filter values
    Object.entries(filterValues).forEach(([key, val]) => {
      if (val !== undefined) {
        where[key] = val
      }
    })

    // Call refineListData with the combined where clause
    refineListData({
      where,
      page: '1',
    })
  }, [filterValues])

  // Convert DateFilterValue to Payload where clause
  const handleDateFilterChange = useCallback(
    (fieldName: string, value: DateFilterValue) => {
      if (!value || !value.customRange) {
        updateFilterValue(fieldName, undefined)
        return
      }

      const { from, to } = value.customRange
      const filter: any = {}

      if (from) {
        filter.greater_than_equal = from.toISOString()
      }

      if (to) {
        filter.less_than = to.toISOString()
      }

      updateFilterValue(fieldName, Object.keys(filter).length > 0 ? filter : undefined)
    },
    [updateFilterValue],
  )

  // Convert SelectFilterValue to Payload where clause
  const handleSelectFilterChange = useCallback(
    (fieldName: string, value: SelectFilterValue) => {
      if (
        !value ||
        value.type === 'none' ||
        !value.selectedValues ||
        value.selectedValues.length === 0
      ) {
        updateFilterValue(fieldName, undefined)
        return
      }

      if (value.selectedValues.length === 1) {
        updateFilterValue(fieldName, {
          equals: value.selectedValues[0],
        })
      } else {
        updateFilterValue(fieldName, {
          in: value.selectedValues,
        })
      }
    },
    [updateFilterValue],
  )

  // Convert CheckboxFilterState to Payload where clause
  const handleCheckboxFilterChange = useCallback(
    (fieldName: string, state: CheckboxFilterState) => {
      if (state === 'unchecked') {
        updateFilterValue(fieldName, {
          equals: false,
        })
      } else if (state === 'checked') {
        updateFilterValue(fieldName, {
          equals: true,
        })
      } else {
        updateFilterValue(fieldName, undefined)
      }
    },
    [updateFilterValue],
  )

  if (!fields.length) return null
  const userLocale = { code: i18n.language, direction: 'rtl' }
  //console.log('userLocale', userLocale)
  return (
    <div className="filter-container">
      <div className={`grid gap-6 md:grid-cols-1 lg:grid-cols-6`}>
        {fields.map((field) => {
          // Render the appropriate filter component based on field type
          switch (field.type) {
            case 'date':
              return (
                <DateFilter
                  label={field.label}
                  value={field.value}
                  key={field.name}
                  onChange={(value) => handleDateFilterChange(field.name, value)}
                  locale={userLocale as Locale}
                />
              )
            case 'select':
              if (field.options.length <= 3) {
                return (
                  <SmallSelectFilter
                    label={field.label}
                    key={field.name}
                    options={(field.options || []).map((option: any) => ({
                      label: option.label,
                      value: option.value,
                    }))}
                    onChange={(value) => handleSelectFilterChange(field.name, value)}
                    locale={userLocale as Locale}
                  />
                )
              }
              return (
                <SelectFilter
                  label={field.label}
                  key={field.name}
                  options={(field.options || []).map((option: any) => ({
                    label: option.label,
                    value: option.value,
                  }))}
                  onChange={(value) => handleSelectFilterChange(field.name, value)}
                  locale={userLocale as Locale}
                />
              )
            case 'checkbox':
              return (
                <CheckboxFilter
                  label={field.label}
                  key={field.name}
                  onChange={(state) => handleCheckboxFilterChange(field.name, state)}
                  checkboxLabel={''}
                  locale={userLocale as Locale}
                />
              )
            default:
              return null
          }
        })}
      </div>
    </div>
  )
}

export default DirectFilter
