import type { Config, Field, SelectField } from 'payload'
import { FieldAffectingData } from 'payload'

export type CollectionFilterPluginConfig = {
  /**
   * List of collections to add filters to
   */
  disabled?: boolean
}

// Recursive function to find fields by name
function findFieldsByName(fields: Field[], fieldNames: string[]): Field[] {
  const results: Field[] = []

  function recursiveSearch(fields: Field[]) {
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
      if (item.type === 'tabs' && 'tabs' in item && Array.isArray(item.tabs)) {
        item.tabs.forEach((tab) => {
          if ('fields' in tab && Array.isArray(tab.fields)) {
            recursiveSearch(tab.fields)
          }
        })
      }
      if (item.type === 'blocks' && 'blocks' in item && Array.isArray(item.blocks)) {
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

export const CollectionFilterPlugin =
  (pluginOptions: CollectionFilterPluginConfig = {}) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    // Process each collection to add the DirectFilter component
    config.collections = config.collections.map((collection) => {
      // Check if the collection has a filterList configuration
      // or if it's specified in the plugin options
      if (collection.custom?.filterList && Array.isArray(collection.custom.filterList)) {
        // Clone the collection to avoid mutating the original
        const newCollection = { ...collection }

        // Initialize components if not exists
        if (!newCollection.admin) {
          newCollection.admin = {}
        }

        if (!newCollection.admin.components) {
          newCollection.admin.components = {}
        }

        if (!newCollection.admin.components.beforeListTable) {
          newCollection.admin.components.beforeListTable = []
        } else if (!Array.isArray(newCollection.admin.components.beforeListTable)) {
          // If it's not an array, convert it to an array
          newCollection.admin.components.beforeListTable = [
            newCollection.admin.components.beforeListTable,
          ]
        }

        // Use the global findFieldsByName function defined at the top of the file
        const fields = findFieldsByName(
          collection.fields,
          collection?.custom?.filterList as string[],
        )
        //Extract only name label type options from fields
        const simplifiedFields = fields.map((field) => ({
          name: (field as FieldAffectingData).name,
          label: (field as FieldAffectingData).label,
          type: field.type,
          options: (field as SelectField).options,
        }))

        // Sort the simplified fields to match the order in filterList
        const sortedFields = (collection?.custom?.filterList as string[]).map(fieldName => 
          simplifiedFields.find(field => field.name === fieldName)
        ).filter(Boolean)

        // Add the DirectFilter component
        newCollection.admin.components.beforeListTable.push({
          path: '/plugins/filter/DirectFilter',
          clientProps: {
            filterList: sortedFields,
          },
        })

        return newCollection
      }

      return collection
    })

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     * If your plugin heavily modifies the database schema, you may want to remove this property.
     */
    if (pluginOptions.disabled) {
      return config
    }

    return config
  }

export default CollectionFilterPlugin
