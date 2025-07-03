'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useListQuery } from '@payloadcms/ui'
import { DateFilter } from '@/plugins/filter/filters/components/date-filter'
import { SelectFilter } from '@/plugins/filter/filters/components/select-filter'
import { CheckboxFilter } from '@/plugins/filter/filters/components/checkbox-filter'
import { Field } from 'payload'
import type {
  CheckboxFilterState,
  DateFilterValue,
  Locale,
  SelectFilterValue,
} from '@/types/filter-types'

const DirectFilter = ({ filterList }: { filterList: Field[] }) => {
  const [fields, setFields] = useState<any[]>([])
  const { refineListData } = useListQuery()
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const [locale, setLocale] = useState<Locale>({ code: 'he', direction: 'rtl' })

  useEffect(() => {
    // Get the fields from the collection's custom.filterList
    if (filterList && Array.isArray(filterList)) {
      setFields(filterList)
    }
  }, [])

  // This function will be called by each filter component when its value changes
  const updateFilterValue = useCallback(
    (fieldName: string, value: any) => {
      setFilterValues((prev) => {
        const newValues = { ...prev, [fieldName]: value }

        // Apply all filters at once
        const where: Record<string, any> = {}

        // Build the where clause from all filter values
        Object.entries(newValues).forEach(([key, val]) => {
          if (val !== undefined) {
            where[key] = val
          }
        })

        // Call refineListData with the combined where clause
        refineListData({
          where,
          page: '1',
        })

        return newValues
      })
    },
    [refineListData],
  )

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
    <div className="filter-container">
      <div className={`grid gap-6 md:grid-cols-1 lg:grid-cols-${fields.length}`}>
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
                  locale={locale}
                />
              )
            case 'select':
              return (
                <SelectFilter
                  label={field.label}
                  key={field.name}
                  options={(field.options || []).map((option: any) => ({
                    label: option.label,
                    value: option.value,
                  }))}
                  onChange={(value) => handleSelectFilterChange(field.name, value)}
                  locale={locale}
                />
              )
            case 'checkbox':
              return (
                <CheckboxFilter
                  label={field.label}
                  key={field.name}
                  onChange={(state) => handleCheckboxFilterChange(field.name, state)}
                  checkboxLabel={''}
                  locale={locale}
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
