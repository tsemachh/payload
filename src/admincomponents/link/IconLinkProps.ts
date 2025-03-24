/**
 * Shared props for IconLink components
 * @interface IconLinkProps
 * @property {string} urlTemplate - Template string for generating the URL, use ${value} for the field value
 * @property {string} iconUrl - URL of the icon to display
 * @property {string} iconAltText - Alt text for the icon
 * @property {Record<string, any>} [visibilityConditions] - Optional object with field-value pairs for controlling visibility
 */
export interface IconLinkProps {
  urlTemplate: string
  iconUrl: string
  iconAltText: string
  visibilityConditions?: Record<string, any>
  iconOnly?: boolean
}
