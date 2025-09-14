import type { CollectionConfig } from 'payload'
import { isAdmin, isLoggedIn } from '@/utils/authUtils'

export const StockValues: CollectionConfig = {
  slug: 'stock-values',
  labels: {
    plural: 'שווי ניירות ערך',
    singular: ' שווי נייר ערך',
  },
  admin: {
    hidden: false,
    group: 'פיתוח',
    useAsTitle: 'stockName',
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
              displayFormat: 'dd MMM yyy',
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

  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        const { stockId, id } = doc

        await req.payload.update({
          collection: 'meetings',
          req: {
            ...req,
            context: { ...req.context, from: 'process' },
          },
          data: {
            stockValue: id,
          },
          where: {
            and: [
              { stockValue: { not_equals: id } },
              { stock: { equals: stockId } },
              {
                or: [
                  {
                    meetingDate: { greater_than_equal: new Date() },
                  },
                  {
                    meetingDate: { exists: false },
                  },
                ],
              },
            ],
          },
        })
      },
    ],
  },
}
