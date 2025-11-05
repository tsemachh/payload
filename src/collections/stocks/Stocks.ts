import type { CollectionConfig } from 'payload'
import ImportStocksEndPoint from '@/collections/stocks/imports/ImportStocksEndPoint'
import uploadStockCsvEndPoint from '@/collections/stocks/feeds/uploadStockCsvEndPoint'
import fixStockRelationsEndPoint, {
  getTradableStocks,
} from '@/collections/stocks/endpoints/fixStockRelationsEndPoint'
import { IconLinkProps } from '@/admincomponents/link/IconLinkProps'
import { stockTypeOptions } from '@/consts/otipns-const'
import { stockOriginOptions } from '@/app/(frontend)/meetings/filtersConst'
import { isAdmin, isLoggedIn } from '@/utils/authUtils'

const stockLinkProps: IconLinkProps = {
  urlTemplate: 'https://market.tase.co.il/he/market_data/security/${value}/major_data',
  iconUrl: '/faviconStock.ico',
  iconAltText: 'קישור לבורסה',
  visibilityConditions: { origin: 'TASE', tradable: true, fromMagna: true },
}
const validateTradableRelations = async (
  value: boolean | null | undefined,
  { req, data, id }: any,
): Promise<true | string> => {
  if (req.context?.from === 'migration') {
    return true
  }

  if (value === true && data?.relatedStock)
    return 'אין אפשרות להפוך לסחיר נייר שיש לו נייר ערך ראשי'
  if (value === false && data?.relations?.docs.length > 0) {
    return 'אין אפשרות להפוך ללא סחיר נייר שיש לו נירות עוקבים'
  }

  return true
}
const validateNoFutureMeetings = async (
  value: boolean | null | undefined,
  { req, data, id }: any,
): Promise<true | string> => {
  if (req.context?.from === 'migration') {
    return true
  }

  if (value === false) {
    const stockId = id || data?.id
    if (!stockId) return true

    const currentDate = new Date()
    const futureMeetings = await req.payload.find({
      collection: 'meetings',
      where: {
        and: [
          { stock: { equals: stockId } },
          { meetingDate: { greater_than: currentDate.toISOString() } },
          { state: { not_equals: 'cancelled' } },
        ],
      },
    })

    if (futureMeetings.docs.length > 0) {
      return 'לא ניתן להגדיר נייר ערך כלא פעיל כאשר יש אסיפות עתידיות מתוכננות עבורו'
    }
  }
  return true
}

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  labels: {
    plural: 'ניירות ערך',
    singular: 'נייר ערך',
  },
  custom: {
    filterList: [
      [{ name: 'type' }, { name: 'origin' }, { name: 'tradable' }, { name: 'active' }],
      [{ name: 'fromMagna' }, { name: 'isFinancial' }, { name: 'hasDual' }, { name: 'isDual' }],
    ],
    defaultFilter: { active: { equals: true } },
  },
  access: {
    create: isAdmin,
    read: isLoggedIn,
    update: isAdmin,
    delete: isAdmin,
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['stockId', 'type', 'longName', 'origin', 'tradable', 'active'],
    listSearchableFields: ['symbol', 'stockId', 'name', 'longName', 'comments'],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
    group: 'פעילות',
  },
  versions: {
    drafts: false,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'כללי',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'stockId',
                  type: 'text',
                  label: 'מספר נייר',
                  unique: true,
                  required: true,
                  index: true,
                  access: { update: () => false },
                  admin: {
                    width: '200px',
                    components: {
                      Cell: {
                        path: '/admincomponents/link/IconLinkCell',
                        clientProps: stockLinkProps,
                      },
                      Field: {
                        path: '/admincomponents/link/IconLinkTextField',
                        clientProps: stockLinkProps,
                      },
                    },
                  },
                },
                {
                  name: 'fullName',
                  label: 'שם מלא',
                  type: 'text', // Stored in the database
                  admin: {
                    hidden: true, // Hide in admin UI to prevent manual edits
                  },
                  index: true,
                  hooks: {
                    beforeChange: [
                      async ({ data }) => {
                        return `${data?.name} - ${data?.stockId}`
                      },
                    ],
                  },
                },
                {
                  name: 'type',
                  label: 'סוג',
                  type: 'select',
                  interfaceName: 'StockType',
                  required: true,
                  options: stockTypeOptions,
                  index: true,
                  admin: {
                    condition: (siblingData) => siblingData.tradable,
                    width: '200px',
                  },
                },
                {
                  name: 'fromMagna',
                  label: 'ממגנא',
                  type: 'checkbox',
                  admin: {
                    hidden: true,
                  },
                  defaultValue: false,
                },
                {
                  name: 'origin',
                  label: 'מקור',
                  type: 'select',
                  interfaceName: 'StockOrigin',
                  options: stockOriginOptions,
                  index: true,
                  required: true,
                  defaultValue: 'TASE',
                  admin: {
                    width: '150px',
                  },
                },
                {
                  name: 'tradable',
                  label: 'האם נסחר',
                  type: 'checkbox',
                  admin: {
                    width: '150px',
                  },
                  validate: validateTradableRelations,
                  access: {
                    update: ({ doc }) => !doc?.fromMagna,
                  },
                },
                {
                  name: 'relatedStock',
                  label: 'נייר ערך ראשי',
                  type: 'relationship',
                  relationTo: 'stocks',
                  index: true,
                  admin: {
                    width: '450px',
                    condition: (siblingData) => !siblingData.tradable,
                  },
                  filterOptions: ({ req }: any) => {
                    if (req.context?.from == 'migration' || req.context?.from == 'process') {
                      return true
                    }
                    return {
                      tradable: { equals: true },
                    }
                  },
                },
                {
                  name: 'active',
                  label: 'נייר ערך פעיל',
                  type: 'checkbox',
                  index: true,
                  defaultValue: true,
                  validate: validateNoFutureMeetings,
                  access: {
                    update: ({ doc }) => !doc?.relatedStock,
                  },
                  admin: {
                    width: '150px',
                  },
                  hooks: {
                    beforeChange: [
                      async ({ value, originalDoc, req, operation }) => {
                        // Skip processing during migrations
                        if (req.context?.from === 'migration' || req.context?.from === 'process') {
                          return value
                        }

                        // Only run this hook when updating a document
                        if (operation === 'update') {
                          // Update all related stocks to be same active status
                          await req.payload.update({
                            collection: 'stocks',
                            data: {
                              active: value,
                            },
                            where: {
                              relatedStock: { equals: originalDoc.id },
                            },
                            req,
                          })
                        }
                        return value
                      },
                    ],
                  },
                },
                {
                  name: 'isFinancial',
                  label: 'פיננסי',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '100px',
                    condition: (siblingData) => siblingData.type == 'מניות',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'isDual',
                  label: 'דואלי',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    readOnly: true,
                    width: '150px',
                    condition: (data) => Boolean(data?.id),
                  },
                },
                {
                  name: 'mainStockForDualStock',
                  label: 'קישור לנייר הערך המכיל',
                  type: 'relationship',
                  relationTo: 'stocks',
                  admin: {
                    readOnly: true,
                    condition: (siblingData) => siblingData.isDual,
                    width: '400px',
                  },
                  filterOptions: ({ req }) => {
                    if (req.context?.from == 'migration' || req.context?.from == 'process') {
                      return true
                    }
                    return {
                      hasDual: { equals: true },
                    }
                  },
                },
                {
                  name: 'hasDual',
                  label: 'מכיל דואלי',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '150px',
                  },
                },
                {
                  name: 'dualStock',
                  label: 'קישור לנייר הערך הדואלי',
                  type: 'relationship',
                  relationTo: 'stocks',
                  admin: {
                    condition: (siblingData) => siblingData.hasDual,
                    width: '400px',
                  },
                  validate: (value: any, { data }: any) => {
                    if (data?.hasDual && !value) {
                      return 'יש לבחור נייר ערך דואלי כאשר המניה מכילה דואלי'
                    }
                    return true
                  },
                  filterOptions: ({ req }) => {
                    if (req.context?.from == 'migration' || req.context?.from == 'process') {
                      return true
                    }
                    return {
                      origin: { equals: 'Foreign' },
                    }
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'symbol',
                  label: 'סימול',
                  type: 'text',
                  index: true,
                  admin: { condition: (siblingData) => siblingData.tradable },
                },
                {
                  name: 'name',
                  label: 'שם נייר ערך',
                  type: 'text',
                  index: true,
                  admin: { condition: (siblingData) => siblingData.tradable },
                },
                {
                  name: 'longName',
                  label: 'שם תאגיד',
                  type: 'text',
                  admin: {
                    condition: (siblingData) =>
                      siblingData.tradable || siblingData.origin == 'Private',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'values',
                  label: 'שווי',
                  type: 'join',
                  collection: 'stock-values',
                  on: 'stockId',
                  _sanitized: true,
                  admin: {
                    condition: (siblingData) => siblingData.tradable,
                    defaultColumns: [
                      'id',
                      'valueDate',
                      'registeredValue',
                      'closingRate',
                      'marketValue',
                    ],
                    disableListColumn: true,
                  },
                },
              ],
            },
            {
              name: 'comments',
              label: 'הערות',
              index: true,
              type: 'textarea',
            },
          ],
        },
        {
          label: 'ניירות ערך עוקבים',
          admin: { condition: (siblingData) => siblingData.tradable },
          fields: [
            {
              name: 'relations',
              label: 'ניירות ערך עוקבים',
              type: 'join',
              collection: 'stocks',
              on: 'relatedStock',
              //              _sanitized: true,
              admin: {
                defaultColumns: ['stockId', 'type', 'symbol', 'name', 'longName'],
                disableListColumn: true,
              },
            },
          ],
        },
        {
          label: 'אסיפות',
          admin: {
            condition: (siblingData) => siblingData.tradable || siblingData.origin == 'Private',
          },
          fields: [
            {
              name: 'meetings',
              label: 'אסיפות',
              type: 'join',
              collection: 'meetings',
              on: 'stock',
              _sanitized: true,
              admin: {
                defaultColumns: ['meetingId', 'meetingDate', 'meetingType'],
                disableListColumn: true,
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async ({ req, doc, operation, previousDoc }) => {
        // Skip if from migration or process context
        if (req.context?.from === 'migration' || req.context?.from === 'process') {
          return
        }

        const isCreate = operation === 'create'

        // For create, previousState will be undefined
        const hasDualChanged = isCreate ? false : previousDoc?.hasDual !== doc.hasDual
        const dualStockChanged = isCreate ? false : previousDoc?.dualStock !== doc.dualStock

        // Check if we need to update dual stock relationships
        if (isCreate || hasDualChanged || dualStockChanged) {
          const currentDualStockId = doc.dualStock
          const previousDualStockId = previousDoc?.dualStock

          // If there's a current dual stock and hasDual is true, update it
          if (currentDualStockId && doc.hasDual) {
            try {
              await req.payload.update({
                collection: 'stocks',
                id: currentDualStockId,
                data: {
                  isDual: true,
                  mainStockForDualStock: doc.id,
                },
                context: { from: 'process' },
              })
            } catch (_error) {}
          }

          // If previous dual stock exists and is different from current, clear its fields
          if (previousDualStockId && previousDualStockId !== currentDualStockId) {
            try {
              await req.payload.update({
                collection: 'stocks',
                id: previousDualStockId,
                data: {
                  isDual: false,
                  mainStockForDualStock: null,
                },
                context: { from: 'process' },
              })
            } catch (_error) {}
          }

          // If hasDual is now false, clear the current dual stock's fields
          if (!doc.hasDual && currentDualStockId) {
            try {
              await req.payload.update({
                collection: 'stocks',
                id: currentDualStockId,
                data: {
                  isDual: false,
                  mainStockForDualStock: null,
                },
                context: { from: 'process' },
              })
            } catch (_error) {}
          }
        }
      },
    ],
  },
  endpoints: [
    {
      path: '/import-stocks',
      method: 'post',
      handler: ImportStocksEndPoint,
    },
    {
      path: '/upload-stock-csv',
      method: 'post',
      handler: uploadStockCsvEndPoint,
    },
    {
      path: '/fix-stock-relations',
      method: 'post',
      handler: fixStockRelationsEndPoint,
    },
    {
      path: '/tradable',
      method: 'get',
      handler: getTradableStocks,
    },
  ],
}
