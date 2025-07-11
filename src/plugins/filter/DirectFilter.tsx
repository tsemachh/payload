'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConfig, useListQuery, useTranslation } from '@payloadcms/ui'
import { ClientField, FieldAffectingData, type OptionObject, type SelectField } from 'payload'
import { getTranslation } from '@payloadcms/translations'
import FilterField from './FilterField'
import {
  CheckboxFilterState,
  DateFilterValue,
  FilterDetaild,
  FilterRow,
  SelectFilterValue,
} from './filters/types/filters-type'
import { groupFiltersByRow } from './filters/utils/layout-helpers'
import { ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Recursive function to find fields by name
function findFieldsByName(fields: ClientField[], fieldNames: string[]): ClientField[] {
  const results: ClientField[] = []

  function recursiveSearch(currentFields: ClientField[]) {
    const filteredFields = currentFields.filter(
      (field) => 'name' in field && fieldNames.includes(field.name as string),
    )
    results.push(...filteredFields)

    currentFields.forEach((item) => {
      if (
        (item.type === 'array' || item.type === 'row' || item.type === 'collapsible') &&
        'fields' in item &&
        Array.isArray(item.fields)
      ) {
        recursiveSearch(item.fields)
      } else if (item.type === 'tabs' && Array.isArray(item.tabs)) {
        item.tabs.forEach((tab) => {
          if ('fields' in tab && Array.isArray(tab.fields)) {
            recursiveSearch(tab.fields)
          }
        })
      } else if (item.type === 'blocks' && Array.isArray(item.blocks)) {
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

// Helper function to convert UI state to a where query
const buildWhereClause = (
  values: Record<string, any>,
  fieldDefs: FilterDetaild[],
): Record<string, any> => {
  const where: Record<string, any> = {}

  Object.entries(values).forEach(([fieldName, value]) => {
    if (!value) return

    const fieldDef = fieldDefs.find((f) => f.name === fieldName)
    if (!fieldDef) return

    switch (fieldDef.type) {
      case 'date': {
        const dateValue = value as DateFilterValue
        if (dateValue.customRange) {
          const { from, to } = dateValue.customRange
          const dateQuery: any = {}
          if (from) dateQuery.greater_than_equal = from
          if (to) dateQuery.less_than_equal = to // כולל את יום הסיום
          if (Object.keys(dateQuery).length > 0) {
            where[fieldName] = dateQuery
          }
        }
        break
      }
      case 'select': {
        const selectValue = value as SelectFilterValue
        if (selectValue.selectedValues && selectValue.selectedValues.length > 0) {
          if (selectValue.selectedValues.length === 1) {
            where[fieldName] = { equals: selectValue.selectedValues[0] }
          } else {
            where[fieldName] = { in: selectValue.selectedValues }
          }
        }
        break
      }
      case 'checkbox': {
        const checkboxState = value as CheckboxFilterState
        if (checkboxState === 'checked') {
          where[fieldName] = { equals: true }
        } else if (checkboxState === 'unchecked') {
          where[fieldName] = { equals: false }
        }
        // 'indeterminate' לא יבצע סינון
        break
      }
    }
  })
  return where
}

const DirectFilter = ({
  slug,
  filterList,
}: {
  slug: string
  filterList: (string | { name: string })[][]
}) => {
  const [fields, setFields] = useState<FilterDetaild[]>([])
  const [filterRows, setFilterRows] = useState<FilterRow[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const { refineListData } = useListQuery()
  const { getEntityConfig } = useConfig()
  const { i18n } = useTranslation()

  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const isInitialMount = useRef(true)

  useEffect(() => {
    const collection = getEntityConfig({ collectionSlug: slug })

    // Flatten the array of arrays and extract field names
    const flattenedFieldConfigs = filterList.flatMap((row, rowIndex) => 
      row.map((field, fieldIndex) => ({
        field,
        rowIndex,
        fieldIndex
      }))
    )

    const fieldNames = flattenedFieldConfigs.map(({ field }) => 
      typeof field === 'string' ? field : field.name
    )

    const matchedFields = findFieldsByName(collection?.fields || [], fieldNames)

    const simplifiedFields: FilterDetaild[] = matchedFields.map((field) => {
      const label = (field as FieldAffectingData).label
      const translatedLabel = getTranslation(label as string, i18n)
      const fieldName = (field as FieldAffectingData).name as string

      // Find the corresponding field config with row and order information
      const fieldConfig = flattenedFieldConfigs.find(({ field: f }) => 
        typeof f === 'string' 
          ? f === fieldName
          : f.name === fieldName
      )

      return {
        name: fieldName,
        label: translatedLabel as string,
        type: field.type,
        options: (field as SelectField).options as OptionObject[],
        row: fieldConfig ? fieldConfig.rowIndex : 0,
      }
    })

    // Sort fields by their original order in the filterList
    const sortedFields = flattenedFieldConfigs
      .map(({ field, rowIndex, fieldIndex }) => {
        const fieldName = typeof field === 'string' ? field : field.name
        const matchedField = simplifiedFields.find(f => f.name === fieldName)

        // If we found a matching field, return it
        if (matchedField) {
          return matchedField
        }
        return null
      })
      .filter((f): f is FilterDetaild => !!f)

    setFields(sortedFields)
    setFilterRows(groupFiltersByRow(sortedFields))
  }, [slug, filterList, getEntityConfig, i18n])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const where = buildWhereClause(filterValues, fields)

    refineListData({
      where,
      page: '1',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValues])

  const handleFilterChange = useCallback((fieldName: string, value: any) => {
    setFilterValues((prev) => {
      const newValues = { ...prev }
      if (
        value === undefined ||
        value === null ||
        value === 'indeterminate' ||
        (value && value.type === 'none')
      ) {
        delete newValues[fieldName]
      } else {
        newValues[fieldName] = value
      }
      return newValues
    })
  }, [])

  const memoizedFilterRows = useMemo(() => {
    return filterRows.map((row) => (
      <div key={row.rowNumber}>
        <div className="flex flex-wrap gap-6 mb-4">
          {row.filters.map((field) => (
            <FilterField
              key={field.name}
              field={field}
              onFilterChange={handleFilterChange}
              value={filterValues[field.name]}
            />
          ))}
        </div>
      </div>
    ))
  }, [filterRows, handleFilterChange, filterValues])

  const toggleFilters = () => {
    setShowFilters((prev) => !prev)
  }

  if (!fields.length) return null

  return (
    <div className="filter-container useTw">
      <div style={{ position: 'relative', top: '-22px', height: '0px' }}>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFilters}
          className="flex items-center gap-2 bg-white border-gray-300 hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" />
          <span>{i18n.language === 'he' ? 'סינון ישיר' : 'Direct Filters'}</span>
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      {showFilters && (
        <div
          className={'p-4 pb-2'}
          style={{ border: '5px solid', borderColor: 'rgb(245, 245, 245)' }}
        >
          {memoizedFilterRows}
        </div>
      )}
    </div>
  )
}

export default DirectFilter
