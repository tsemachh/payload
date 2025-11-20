import type { CollectionConfig } from 'payload'

const MigrationFaults: CollectionConfig = {
  slug: 'migration-faults',
  versions: false,
  custom: {
    filterList: [
      [{ name: 'createdAt' }, { name: 'type' }]
    ],
  },
  fields: [
    {
      type: 'select',
      name: 'type',
      index: true,
      options: [
        'holding',
        'user',
        'account',
        'stock',
        'stock-value',
        'stock-relation',
        'meeting',
        'meeting-holdings',
        'meetingAgenda',
        'vote',
        'silenced-stock',
        'company',
        'meeting-unification',
        'migration',
      ],
      interfaceName: 'MigrationType',
    },
    { type: 'text', name: 'typeId', index: true },
    {
      type: 'textarea',
      name: 'row',
      index: true,
    },
    {
      type: 'textarea',
      name: 'comments',
      index: true,
    },
  ],
  enableQueryPresets: true,
  admin: {
    group: 'פיתוח',
    useAsTitle: 'typeId',
    defaultColumns: ['comments', 'type', 'typeId', 'row'],
    listSearchableFields: ['comments', 'type', 'typeId', 'row'],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  labels: {
    plural: 'שגיאות במיגרציה',
    singular: 'שגיאה במיגרציה',
  },
}

export default MigrationFaults
