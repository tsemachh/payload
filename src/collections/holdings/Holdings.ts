import type { CollectionConfig } from 'payload'
import getHoldingsDatesEndPoint from './endpoints/getHoldingsDatesEndPoint'
import uploadHoldingsCsvEndPoint from '@/collections/holdings/feeds/endpoints/uploadHoldingsCsvEndPoint'
import refreshEndPoint from '@/collections/holdings/feeds/endpoints/refreshEndPoint'
import { scheduleProcessHoldingsChangeTask } from '@/tasks/processHoldingsChange'

export const Holdings: CollectionConfig = {
  slug: 'holdings',
  labels: {
    plural: 'אחזקות יומיות',
    singular: 'אחזקה יומית',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['fund', 'valueDate'],
    group: 'אוספים משניים',
  },
  hooks: {
    afterChange: [
      async ({ req, doc }) => {
        if (req.context?.from != 'migration') {
          // Schedule a job to process the holding change instead of processing it directly
          await scheduleProcessHoldingsChangeTask(req.payload, doc.id)
          req.payload.logger.info(`Scheduled holdings change processing for holding ${doc.id}`)
        }
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'fund',
          label: 'תיק',
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
      name: 'holdings',
      label: 'אחזקות',
      type: 'array',
      required: true,
      interfaceName: 'HoldingsPerDay',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'stock',
              label: 'נייר ערך',
              type: 'relationship',
              relationTo: 'stocks',
              required: true,
              filterOptions: ({ req }) => {
                if (req.context?.from == 'migration') return true
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
