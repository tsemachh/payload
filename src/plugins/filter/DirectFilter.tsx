'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useConfig, useTranslation } from '@payloadcms/ui'
import { ClientField, FieldAffectingData, type SelectField } from 'payload'
import { getTranslation } from '@payloadcms/translations'
import FilterField from './FilterField'
import { FilterDetaild, FilterRow } from './filters/types/filters-type'
import { groupFiltersByRow } from './filters/utils/layout-helpers'
import { ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

      if (item.type === 'tabs' && Array.isArray(item.tabs)) {
        item.tabs.forEach((tab) => {
          if ('fields' in tab && Array.isArray(tab.fields)) {
            recursiveSearch(tab.fields)
          }
        })
      }

      if (item.type === 'blocks' && Array.isArray(item.blocks)) {
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
  const [filterRows, setFilterRows] = useState<FilterRow[]>([])

  const { getEntityConfig } = useConfig()
  const { i18n } = useTranslation()
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    const collection = getEntityConfig({ collectionSlug: slug })
    const fieldNames = filterList.map((f) => f.name)
    const matchedFields = findFieldsByName(collection?.fields, fieldNames)

    const simplifiedFields: FilterDetaild[] = matchedFields.map((field) => {
      const label = (field as FieldAffectingData).label
      const translatedLabel = getTranslation(label as string, i18n)

      const filterConfig = filterList.find((f) => f.name === (field as FieldAffectingData).name)

      return {
        name: (field as FieldAffectingData).name as string,
        label: translatedLabel as string,
        type: field.type,
        options: (field as SelectField).options,
        row: filterConfig?.row ?? undefined,
      }
    })

    const sortedFields = filterList
      .map((filterItem) => simplifiedFields.find((f) => f.name === filterItem.name))
      .filter(Boolean) as FilterDetaild[]

    setFields(sortedFields)

    const filterRowsTmp = groupFiltersByRow(sortedFields)
    setFilterRows(filterRowsTmp)
  }, [])

  const memoizedFilterRows = useMemo(() => {
    return filterRows.map((row) => (
      <div key={row.rowNumber}>
        <div className="flex flex-wrap gap-6 mb-4">
          {row.filters.map((field, index) => (
            <FilterField key={index} field={field} />
          ))}
        </div>
      </div>
    ))
  }, [filterRows])

  const toggleFilters = () => {
    setShowFilters((prev) => !prev)
  }

  if (!fields.length) return null

  return (
    <div className="filter-container useTw">
      {/* Toggle icons positioned above the container */}
      {/* Toggle button positioned above the container */}
      <div style={{ position: 'relative', top: '-23px', height: '0px' }}>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFilters}
          className="flex items-center gap-2 bg-white border-gray-300 hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" />
          <span>{i18n.language == 'he' ? 'סינון ישיר' : 'Direct Filters'}</span>
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      {showFilters && memoizedFilterRows}
    </div>
  )
}

export default DirectFilter
