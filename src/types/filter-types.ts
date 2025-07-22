import { SupportedLocale } from '@/plugins/quickfilter/labels'

export interface DateFilterOption {
  value: string
  label: string
}

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

export interface DateFilterValue {
  type: "predefined" | "custom"
  predefinedValue?: string
  customRange?: DateRange
}

export interface SelectFilterOption {
  value: string
  label: string
}

export interface SelectFilterValue {
  type: "all" | "some" | "none"
  selectedValues: string[]
}

export type CheckboxFilterState = "checked" | "unchecked" | "indeterminate"

export interface Locale {
  code: SupportedLocale
  direction: "rtl" | "ltr"
}
