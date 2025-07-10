'use client'
import React, { useCallback, useEffect, useState, useRef } from 'react'
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

  const isInitialMount = useRef(true)

  const localeLang = i18n.language
  const isRTL = (rtlLanguages as readonly string[]).includes(localeLang)
  const direction = isRTL ? 'rtl' : 'ltr'
  const userLocale = { code: localeLang, direction }

  const updateFilterValue = useCallback((fieldName: string, value: any) => {
    setFilterValues((prev) => ({ ...prev, [fieldName]: value }))
  }, [])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const where: Record<string, any> = {}

    Object.entries(filterValues).forEach(([key, val]) => {
      if (val !== undefined) {
        where[key] = val
      }
    })

    refineListData({
      where,
      page: '1',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValues])

  const handleDateFilterChange = useCallback(
    (fieldName: string, value: DateFilterValue | undefined) => {
      if (!value || !value.customRange || (!value.customRange.from && !value.customRange.to)) {
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

  const handleSelectFilterChange = useCallback(
    (fieldName: string, value: SelectFilterValue | undefined) => {
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

  const handleCheckboxFilterChange = useCallback(
    (fieldName: string, state: CheckboxFilterState | undefined) => {
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
          className={` w-[${field.width || '250px'}]`}
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
            className={` w-[${field.width || '250px'}]`}
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
          className={` w-[${field.width || '250px'}]`}
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
          className={` w-[${field.width || '250px'}]`}
        />
      )
    default:
      return null
  }
}

export default FilterField
