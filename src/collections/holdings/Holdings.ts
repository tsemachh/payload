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
    create: isUserCompanyHoldingWrite,
    read: isUserCompanyHolding,
    update: isUserCompanyHoldingWrite,
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
          admin: {
            readOnly: true,
          },
          filterOptions: () => ({
            type: {
              equals: 'fund',
            },
          }),
        },
        {
          name: 'company',
          label: 'חברה',
          type: 'relationship',
          relationTo: 'companies',
          index: true,
          admin: {
            readOnly: true,
          },
          filterOptions: () => ({
            type: {
              equals: 'regular',
            },
          }),
          virtual: 'fund.parentCompany',
        },
        {
          name: 'valueDate',
          label: 'תאריך ערך',
          type: 'date',
          required: true,
          index: true,
          admin: {
            readOnly: true,
            date: {
              displayFormat: 'dd/MM/yyyy',
              pickerAppearance: 'default',
            },
          },
        },
      ],
    },
    {
      name: 'stats',
      label: 'סטטיסטיקות',
      type: 'group',
      admin: {
        readOnly: true,
        hidden: true,
      },
      fields: [
        {
          name: 'recordCount',
          label: 'מספר רשומות',
          type: 'number',
        },
        {
          name: 'accountIds',
          label: 'מזהי חשבונות',
          type: 'json',
          admin: {
            hidden: true,
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
      admin: {
        components: {
          Field: '/admincomponents/fields/arrayHoldingsTable',
        },
      },
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
              name: 'originalData',
              label: 'החזקה מקורית',
              type: 'array',
              admin: {
                initCollapsed: true,
                width: '50%',
                components: {
                  Field: '/admincomponents/fields/arrayTable',
                },
                condition: (data, siblingData) => {
                  return (
                    Array.isArray(siblingData.originalData) && siblingData.originalData.length > 0
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
  // Performance: add compound indexes to support historical lookups
  // - {'holdings.stock': 1, fund: 1, valueDate: -1} optimizes scans by stock+fund within a date range and supports sorting by newest first
  // - {fund: 1, valueDate: -1} optimizes current-day queries that fetch latest holdings per fund
  indexes: [
    {
      fields: ['fund', 'valueDate'],
    },
    {
      fields: ['fund', 'valueDate', 'holdings.stock'],
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
