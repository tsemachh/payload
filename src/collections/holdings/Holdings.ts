import type { CollectionConfig } from 'payload'
import { updateCompaniesMeetingsOnHoldingChange } from './hooks/updateCompaniesMeetings'
import uploadHoldingsCsvEndPoint from './feeds/uploadHoldingsCsvEndPoint'
import refreshEndPoint from './feeds/refreshEndPoint'
import getHoldingsDatesEndPoint from './feeds/getHoldingsDatesEndPoint'

export const Holdings: CollectionConfig = {
  slug: 'holdings',
  labels: {
    plural: 'אחזקות',
    singular: 'אחזקה',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['account', 'stock', 'quantity', 'valueDate'],
    group: 'אוספים משניים',
  },
  hooks: {
    afterChange: [
      async ({ req, doc }) => {
        if (req.context?.from != 'migration') await updateCompaniesMeetingsOnHoldingChange(req, doc)
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'fund',
          label: 'קרן',
          type: 'relationship',
          relationTo: 'companies',
          required: true,
          index: true,
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
          name: 'stock',
          label: 'נייר ערך',
          type: 'relationship',
          relationTo: 'stocks',
          required: true,
          index: true,
          filterOptions: ({req}) => {
            if (req.context?.from == 'migration')
              return true
            return {
              active: {
                equals: true,
              },
            }
          },
        },
        {
          name: 'feedStockNum',
          label: 'מספר נייר ערך באחזקה',
          type: 'text',
          index: true,
        },
        {
          name: 'quantity',
          label: 'כמות',
          type: 'number',
          required: true,
        },
      ],
    },
  ],
  endpoints: [
    {
      path: '/upload-holdings',
      method: 'post',
      handler: uploadHoldingsCsvEndPoint,
    },
    {
      path: '/refresh',
      method: 'post',
      handler: refreshEndPoint,
    },
    {
      path: '/dates',
      method: 'get',
      handler: getHoldingsDatesEndPoint,
    },
  ],
}
