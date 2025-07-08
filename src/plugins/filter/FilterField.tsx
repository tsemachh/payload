'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useListQuery, useTranslation } from '@payloadcms/ui'
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
import { SmallSelectFilter } from '@/plugins/filter/filters/components/small-select-filter'

const FilterField = ({ field }: { field: any }) => {
  const { refineListData } = useListQuery()
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const { i18n } = useTranslation()
  const localeLang = i18n.language
  const isRTL = (rtlLanguages as readonly string[]).includes(localeLang)
  const direction = isRTL ? 'rtl' : 'ltr'
  const userLocale = { code: localeLang, direction }

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

  switch (field.type) {
    case 'date':
      return (
        <DateFilter
          label={field.label}
          value={field.value}
          key={field.name}
          onChange={(value) => handleDateFilterChange(field.name, value)}
          locale={userLocale as Locale}
          className="useTw"
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
            className="useTw"
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
          className="useTw"
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
          className="useTw"
        />
      )
    default:
      return null
  }
}

export default FilterField
