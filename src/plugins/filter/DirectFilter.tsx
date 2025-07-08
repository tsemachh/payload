'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useConfig, useListQuery, useTranslation } from '@payloadcms/ui'
import { rtlLanguages } from '@payloadcms/translations'
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
import FilterField from './FilterField'

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

const DirectFilter = ({
  slug,
  filterList,
}: {
  slug: string
  filterList: { name: string; row?: number; order?: number }[]
}) => {
  const [fields, setFields] = useState<any[]>([])
  const { refineListData } = useListQuery()
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const { getEntityConfig } = useConfig()
  const { i18n } = useTranslation()
  const localeLang = i18n.language
  const isRTL = (rtlLanguages as readonly string[]).includes(localeLang)
  const direction = isRTL ? 'rtl' : 'ltr'
  const userLocale = { code: localeLang, direction }

  useEffect(() => {
    // Now you can access any property from the collection configuration
    const collection = getEntityConfig({ collectionSlug: slug }) // The collection slug
    // Get the fields from the collection's custom.filterList
    // Use the global findFieldsByName function defined at the top of the file
    const fieldNames = filterList.map((f) => f.name)
    const fields = findFieldsByName(collection?.fields, fieldNames)

    // Extract name, label, type, options, row, order
    const simplifiedFields = fields.map((field) => {
      const label = (field as FieldAffectingData).label
      const translatedLabel = getTranslation(label as string, i18n)

      const filterConfig = filterList.find((f) => f.name === (field as FieldAffectingData).name)

      return {
        name: (field as FieldAffectingData).name,
        label: translatedLabel,
        type: field.type,
        options: (field as SelectField).options,
        row: filterConfig?.row ?? undefined,
        order: filterConfig?.order ?? undefined,
      }
    })

    const sortedFields = (filterList as { name: string; row?: number; order?: number }[])
      .map((filterItem) => simplifiedFields.find((f) => f.name === filterItem.name))
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
  return (
    <div className="filter-container useTw">
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-6">
        {fields.map((field) => (
          <FilterField key={field.id} field={field} />
        ))}
      </div>
    </div>
  )
}

export default DirectFilter
