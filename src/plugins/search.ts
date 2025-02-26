import {searchPlugin} from '@payloadcms/plugin-search'
import { Field } from 'payload/types'

export const emadaSearchPlugin = searchPlugin({
  collections: ['stocks', 'meetings', 'migration-faults'],
  defaultPriorities: {
    stocks: 10,
    meetings: 20,
   'migration-faults': 30
  },
  searchOverrides: {
    fields: ({ defaultFields }: { defaultFields: Field[] }): Field[] => [
      ...defaultFields,
      {
        name: 'stockId',
        type: 'text',
      },
      {
        name: 'name',
        type: 'text',
      },
      {
        name: 'symbol',
        type: 'text',
      },
      {
        name: 'meetingId',
        type: 'number',
      },
      {
        name: 'magnaId',
        type: 'text',
      },
      {
        name: 'type',
        type: 'text',
      },
      {
        name: 'typeId',
        type: 'text',
      },
      {
        name: 'comments',
        type: 'text',
      }
    ],
  },
  deleteDrafts: true,
  syncDrafts: false,
})
