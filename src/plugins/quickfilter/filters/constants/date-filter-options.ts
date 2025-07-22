import type { DateFilterOption } from "@/types/filter-types"
import { getLabel } from "../../labels"
import type { SupportedLocale } from "../../labels"

// Define the option keys for past and future date filters
const pastOptionKeys = ["yesterday", "lastWeek", "lastMonth", "allPast"] as const
const futureOptionKeys = ["today", "nextWeek", "nextMonth", "allFuture"] as const

// Create date filter options dynamically based on locale
const createDateFilterOptions = (keys: readonly string[], locale: SupportedLocale | string): DateFilterOption[] => {
  return keys.map(key => ({
    value: key,
    label: getLabel(key as any, locale as SupportedLocale)
  }))
}

export const getDateFilterOptions = (locale: SupportedLocale | string) => {
  return {
    pastOptions: createDateFilterOptions(pastOptionKeys, locale),
    futureOptions: createDateFilterOptions(futureOptionKeys, locale)
  }
}
