import type { CollectionConfig } from 'payload'
import { isAdmin, isLoggedIn } from '@/utils/authUtils'

export const StockValues: CollectionConfig = {
  slug: 'stock-values',
  labels: {
    plural: 'שווי ניירות ערך',
    singular: ' שווי נייר ערך',
  },
  defaultSort: '-valueDate',
  admin: {
    hidden: false,
    group: 'פיתוח',
    useAsTitle: 'valueDate',
    defaultColumns: ['stockId', 'valueDate', 'registeredValue', 'closingRate', 'marketValue'],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  access: {
    create: isAdmin,
    read: isLoggedIn,
    update: isAdmin,
    delete: isAdmin,
  },
  custom: {
    filterList: [[{ name: 'valueDate' }, 'createdAt']],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'stockId',
          label: 'נייר ערך',
          type: 'relationship',
          relationTo: 'stocks',
          required: true,
          index: true,
        },
        {
          name: 'stockName',
          label: 'שם המניה',
          type: 'text',
          virtual: 'stockId.fullName',
          admin: {
            hidden: true,
          },
        },
        {
          name: 'valueDate',
          label: 'תאריך ערך',
          type: 'date',
          required: true,
          index: true,
          admin: {
            date: {
              displayFormat: 'dd/MM/yyyy',
              pickerAppearance: 'default',
            },
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'closingRate',
          label: 'שער סגירה',
          type: 'number',
          admin: {
            components: {
              Cell: {
                path: '/admincomponents/cell/FormattedNumber',
              },
            },
          },
        },
        {
          name: 'marketValue',
          label: 'שווי שוק',
          type: 'number',
          admin: {
            readOnly: true,
            components: {
              Cell: {
                path: '/admincomponents/cell/FormattedNumber',
              },
            },
          },
          hooks: {
            beforeChange: [
              async ({ data }) => {
                if (data?.closingRate && data?.registeredValue) {
                  return (data.closingRate * data.registeredValue) / 100
                }
                return null
              },
            ],
          },
        },
        {
          name: 'registeredValue',
          label: 'הון רשום',
          type: 'number',
          admin: {
            components: {
              Cell: {
                path: '/admincomponents/cell/FormattedNumber',
              },
            },
          },
        },
      ],
    },
  ],
  indexes: [
    {
      fields: ['stockId', 'valueDate'],
      unique: true,
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        const { stockId, id } = doc

        if (req.context?.from !== 'migration') {
          // Try to resolve dual counterpart ID from populated relation (if available)
          const dualId =
            typeof stockId === 'object' && stockId && 'dualStock' in (stockId as any)
              ? (stockId as any).dualStock
              : undefined

          const stockFilter = dualId
            ? { or: [{ stock: { equals: stockId } }, { stock: { equals: dualId } }] }
            : { stock: { equals: stockId } }

          await req.payload.update({
            collection: 'meetings',
            req: {
              ...req,
              context: { ...req.context, from: 'process', process: 'StockValuesAfterChange' },
            },
            data: {
              stockValue: id,
            },
            where: {
              and: [
                { stockValue: { not_equals: id } },
                stockFilter as any,
                {
                  or: [
                    {
                      meetingDate: { greater_than_equal: new Date() },
                    },
                  ],
                },
              ],
            },
          })
        }
      },
    ],
  },
}
