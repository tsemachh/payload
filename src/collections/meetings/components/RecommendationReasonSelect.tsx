'use client'
import React, { useEffect, useState } from 'react'
import { SelectField } from '@payloadcms/ui'
import { RecommendationReason } from '@/payload-types'
import type { SelectFieldClientProps } from 'payload'

export interface SelectFieldOption {
  label: string
  value: string
}

// Cache for recommendation reasons data
interface CacheData {
  options: SelectFieldOption[];
  timestamp: number;
}

// Module-level cache to persist between component renders
let recommendationReasonsCache: CacheData | null = null;
// Cache expiration time in milliseconds (e.g., 5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

const RecommendationReasonSelect: React.FC<SelectFieldClientProps> = (props) => {
  const [options, setOptions] = useState<SelectFieldOption[]>([])

  useEffect(() => {
    const fetchRecommendationReasons = async () => {
      // Check if we have valid cached data
      const now = Date.now();
      if (
        recommendationReasonsCache && 
        recommendationReasonsCache.options.length > 0 && 
        now - recommendationReasonsCache.timestamp < CACHE_EXPIRATION
      ) {
        // Use cached data if it exists and is not expired
        setOptions(recommendationReasonsCache.options);
        return;
      }

      try {
        const response = await fetch('/api/recommendation-reasons?limit=0')
        const data = await response.json()

        if (data.docs && Array.isArray(data.docs)) {
          const formattedOptions = data.docs.map((reason: RecommendationReason) => ({
            label: reason.content,
            value: reason.content,
          }))

          // Update the state
          setOptions(formattedOptions)

          // Update the cache
          recommendationReasonsCache = {
            options: formattedOptions,
            timestamp: now
          };
        }
      } catch (error) {
        console.error('Error fetching recommendation reasons:', error)
      }
    }

    fetchRecommendationReasons()
  }, [])

  return (
    <SelectField
      {...props}
      field={{
        ...(props.field || {}),
        options,
      }}
    />
  )
}

export default RecommendationReasonSelect
