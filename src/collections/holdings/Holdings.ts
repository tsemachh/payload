import type { CollectionConfig } from 'payload'
import getHoldingsDatesEndPoint from './endpoints/getHoldingsDatesEndPoint'
import uploadHoldingsCsvEndPoint from '@/collections/holdings/feeds/endpoints/uploadHoldingsCsvEndPoint'
import refreshEndPoint from '@/collections/holdings/feeds/endpoints/refreshEndPoint'
import { scheduleProcessHoldingsChangeTask } from '@/tasks/processHoldingsChange'
import { isUserCompanyHolding, isUserCompanyHoldingWrite } from '@/utils/authUtils'

export const Holdings: CollectionConfig = {
  slug: 'holdings',
  labels: {
    plural: 'החזקות יומיות',
    singular: 'החזקה יומית',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['fund', 'valueDate'],
    group: 'פעילות',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  access: {
    // Only admins can create users
    create: isUserCompanyHoldingWrite,
    // Admins can read all, but any other logged in user can only read themselves
    read: isUserCompanyHolding,
    // Admins can update all, but any other logged in user can only update themselves
    update: isUserCompanyHoldingWrite,
    // Only admins can delete
    delete: isUserCompanyHoldingWrite,
  },
  custom: {
    filterList: [[{ name: 'valueDate' }]],
    defaultFilter: { valueDate: 'last30Days' },
  },
  disableBulkEdit: true,
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
          filterOptions: () => ({
            type: {
              equals: 'fund',
            },
          }),
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
      label: 'החזקות',
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
              admin: {
                width: '30%',
              },
              filterOptions: ({ req }) => {
                if (req.context?.from == 'migration' || req.context?.from == 'process') return true
                return {
                  active: {
                    equals: true,
                  },
                }
              },
            },
            {
              name: 'quantity',
              label: 'כמות',
              type: 'number',
              required: true,
              admin: {
                width: '20%',
              },
            },
            {
              name: 'originalForeignData',
              label: 'החזקה מקורית מניית חול',
              type: 'array',
              admin: {
                initCollapsed: true,
                width: '50%',
                components: {
                  Field: '/admincomponents/fields/arrayTable',
                },
                condition: (data, siblingData) => {
                  return (
                    Array.isArray(siblingData.originalForeignData) &&
                    siblingData.originalForeignData.length > 0
                  )
                },
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'stockId',
                      type: 'text',
                    },
                    {
                      name: 'accountNum',
                      type: 'number',
                    },
                    {
                      name: 'quantity',
                      type: 'number',
                    },
                  ],
                },
              ],
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
