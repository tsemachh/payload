import type { CollectionConfig } from 'payload'
import ImportStocksEndPoint from '@/collections/stocks/imports/ImportStocksEndPoint'
import uploadStockCsvEndPoint from '@/collections/stocks/feeds/uploadStockCsvEndPoint'
import fixStockRelationsEndPoint from '@/collections/stocks/endpoints/fixStockRelationsEndPoint'
import { IconLinkProps } from '@/admincomponents/link/IconLinkProps'

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
    singular: {
      en: 'Stock',
      he: 'נייר ערך',
    },
    plural: {
      en: 'Stocks',
      he: 'ניירות ערך',
    },
  },
  custom: {
    filterList: [
      [{ name: 'type' }, { name: 'origin' }, { name: 'tradable' }, { name: 'active' }],
      [{ name: 'fromMagna' }, { name: 'isFinancial' }, { name: 'isDual' }],
    ],
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['stockId', 'symbol', 'type', 'longName', 'origin', 'tradable'],
    listSearchableFields: ['symbol', 'stockId', 'name', 'longName', 'comments'],
    pagination: {
      defaultLimit: 500,
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
          label: {
            en: 'General',
            he: 'כללי',
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'stockId',
                  type: 'text',
                  label: {
                    en: 'Stock ID',
                    he: 'מספר נייר',
                  },
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
                  label: {
                    en: 'Full Name',
                    he: 'שם מלא',
                  },
                  type: 'text', // Stored in the database
                  admin: {
                    hidden: true, // Hide in admin UI to prevent manual edits
                  },
                  index: true,
                  hooks: {
                    beforeChange: [
                      async ({ data }) => {
                        return `${data?.name}(${data?.stockId})`
                      },
                    ],
                  },
                },
                {
                  name: 'type',
                  label: {
                    en: 'Type',
                    he: 'סוג',
                  },
                  type: 'select',
                  interfaceName: 'StockType',
                  options: [
                    {
                      label: {
                        en: 'Stocks',
                        he: 'מניות',
                        ar: 'أسهم',
                        es: 'Acciones',
                      },
                      value: 'מניות',
                    },
                    {
                      label: {
                        en: 'Options',
                        he: 'אופציות',
                        ar: 'خيارات',
                        es: 'Opciones',
                      },
                      value: 'אופציות',
                    },
                    {
                      label: {
                        en: 'Bonds',
                        he: 'איגרות חוב',
                        ar: 'سندات',
                        es: 'Bonos',
                      },
                      value: 'איגרות חוב',
                    },
                    {
                      label: {
                        en: 'Convertible Bonds',
                        he: 'איגרות חוב להמרה',
                        ar: 'سندات قابلة للتحويل',
                        es: 'Bonos Convertibles',
                      },
                      value: 'איגרות חוב להמרה',
                    },
                    {
                      label: {
                        en: 'Participation Unit',
                        he: 'יחידת השתתפות',
                        ar: 'وحدة مشاركة',
                        es: 'Unidad de Participación',
                      },
                      value: 'יחידת השתתפות',
                    },
                    {
                      label: {
                        en: 'Index Certificates',
                        he: 'תעודות מדד',
                        ar: 'شهادات المؤشر',
                        es: 'Certificados de Índice',
                      },
                      value: 'תעודות מדד',
                    },
                    {
                      label: {
                        en: 'ETFs',
                        he: 'תעודות סל',
                        ar: 'صناديق المؤشرات المتداولة',
                        es: 'ETFs',
                      },
                      value: 'תעודות סל',
                    },
                    {
                      label: {
                        en: 'Mutual Funds',
                        he: 'קרנות נאמנות',
                        ar: 'صناديق الاستثمار المشتركة',
                        es: 'Fondos Mutuos',
                      },
                      value: 'קרנות נאמנות',
                    },
                    {
                      label: {
                        en: 'Commercial Paper',
                        he: 'נייר ערך מסחרי',
                        ar: 'ورقة تجارية',
                        es: 'Papel Comercial',
                      },
                      value: 'נייר ערך מסחרי',
                    },
                    {
                      label: {
                        en: 'Other',
                        he: 'אחר',
                        ar: 'آخر',
                        es: 'Otro',
                      },
                      value: 'אחר',
                    },
                    {
                      label: {
                        en: 'Rights',
                        he: 'זכויות',
                        ar: 'حقوق',
                        es: 'Derechos',
                      },
                      value: 'זכויות',
                    },
                    {
                      label: {
                        en: 'Treasury Bills',
                        he: 'מק"מ',
                        ar: 'أذون الخزانة',
                        es: 'Letras del Tesoro',
                      },
                      value: 'מק"מ',
                    },
                    {
                      label: {
                        en: 'Capital Notes',
                        he: 'שטרי הון',
                        ar: 'سندات رأس المال',
                        es: 'Notas de Capital',
                      },
                      value: 'שטרי הון',
                    },
                  ],
                  index: true,
                  admin: {
                    condition: (siblingData) => siblingData.tradable,
                    width: '200px',
                  },
                },
                {
                  name: 'fromMagna',
                  label: {
                    en: 'From Magna',
                    he: 'ממגנא',
                  },
                  type: 'checkbox',
                  admin: {
                    hidden: true,
                  },
                  defaultValue: false,
                },
                {
                  name: 'origin',
                  label: {
                    en: 'Origin',
                    he: 'מקור',
                  },
                  type: 'select',
                  interfaceName: 'StockOrigin',
                  options: [
                    {
                      label: {
                        en: 'Stock Exchange',
                        he: 'בורסה',
                        ar: 'بورصة',
                        es: 'Bolsa de Valores',
                      },
                      value: 'TASE',
                    },
                    {
                      label: {
                        en: 'Foreign',
                        he: 'חו״ל',
                        ar: 'أجنبي',
                        es: 'Extranjero',
                      },
                      value: 'Foreign',
                    },
                    {
                      label: {
                        en: 'Private',
                        he: 'פרטי',
                        ar: 'خاص',
                        es: 'Privado',
                      },
                      value: 'Private',
                    },
                  ],
                  index: true,
                  required: true,
                  defaultValue: 'TASE',
                  admin: {
                    width: '150px',
                  },
                },
                {
                  name: 'tradable',
                  label: {
                    en: 'Tradable',
                    he: 'האם נסחר',
                  },
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
                  label: {
                    en: 'Main Stock',
                    he: 'נייר ערך ראשי',
                  },
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
                  label: {
                    en: 'Active Stock',
                    he: 'נייר ערך פעיל',
                  },
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
                          })
                        }
                        return value
                      },
                    ],
                  },
                },
                {
                  name: 'isFinancial',
                  label: {
                    en: 'Financial',
                    he: 'פיננסי',
                  },
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '100px',
                    condition: (siblingData) => siblingData.type == 'מניות',
                  },
                },

                {
                  name: 'isDual',
                  label: {
                    en: 'Dual',
                    he: 'דואלית',
                  },
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '100px',
                    condition: (siblingData) => siblingData.fromMagna,
                  },
                },
                {
                  name: 'dualStock',
                  label: {
                    en: 'Dual Stock',
                    he: 'נייר ערך דואלי',
                  },
                  type: 'relationship',
                  relationTo: 'stocks',
                  admin: {
                    condition: (siblingData) => siblingData.isDual,
                    width: '400px',
                  },
                  filterOptions: ({ req }: any) => {
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
                  label: {
                    en: 'Symbol',
                    he: 'סימול',
                  },
                  type: 'text',
                  index: true,
                  admin: { condition: (siblingData) => siblingData.tradable },
                },
                {
                  name: 'name',
                  label: {
                    en: 'Stock Name',
                    he: 'שם נייר ערך',
                  },
                  type: 'text',
                  index: true,
                  admin: { condition: (siblingData) => siblingData.tradable },
                },
                {
                  name: 'longName',
                  label: {
                    en: 'Company Name',
                    he: 'שם חברה',
                  },
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
                  label: {
                    en: 'Value',
                    he: 'שווי',
                  },
                  type: 'join',
                  collection: 'stock-values',
                  on: 'stockId',
                  _sanitized: true,
                  admin: {
                    condition: (siblingData) => siblingData.tradable,
                    defaultColumns: ['valueDate', 'registeredValue', 'closingRate', 'marketValue'],
                  },
                },
              ],
            },
            {
              name: 'comments',
              label: {
                en: 'Comments',
                he: 'הערות',
              },
              index: true,
              type: 'textarea',
            },
          ],
        },
        {
          label: {
            en: 'Following Stocks',
            he: 'ניירות ערך עוקבים',
          },
          admin: { condition: (siblingData) => siblingData.tradable },
          fields: [
            {
              name: 'relations',
              label: {
                en: 'Following Stocks',
                he: 'ניירות ערך עוקבים',
              },
              type: 'join',
              collection: 'stocks',
              on: 'relatedStock',
              //              _sanitized: true,
              admin: {
                defaultColumns: ['stockId', 'type', 'symbol', 'name', 'longName'],
              },
            },
          ],
        },
        {
          label: {
            en: 'Meetings',
            he: 'אסיפות',
          },
          admin: {
            condition: (siblingData) => siblingData.tradable || siblingData.origin == 'Private',
          },
          fields: [
            {
              name: 'meetings',
              label: {
                en: 'Meetings',
                he: 'אסיפות',
              },
              type: 'join',
              collection: 'meetings',
              on: 'stock',
              _sanitized: true,
              admin: {
                defaultColumns: ['meetingId', 'meetingDate', 'meetingType'],
              },
            },
          ],
        },
      ],
    },
  ],
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
  ],
}
