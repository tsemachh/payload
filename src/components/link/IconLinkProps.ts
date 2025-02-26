/**
 * Shared props for IconLink components
 * @interface IconLinkProps
 * @property {string} urlTemplate - Template string for generating the URL, use ${value} for the field value
 * @property {string} iconUrl - URL of the icon to display
 * @property {string} iconAltText - Alt text for the icon
 * @property {string} [visibilityField] - Optional field name to control link visibility. Link will only show if this field's value is true
 */
export interface IconLinkProps {
  urlTemplate: string
  iconUrl: string
  iconAltText: string
  visibilityField?: string
}