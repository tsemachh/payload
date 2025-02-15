import type { CollectionConfig } from 'payload'

export const MeetingTypes: CollectionConfig = {
  slug: 'meeting-types',
  labels: {
    plural: 'סוגי אסיפות',
    singular: 'סוג אסיפה',
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'typeId',
      label: "מס' סוג אסיפה",
      type: 'number',
      required: true,
      unique: true,
    },
    {
      name: 'name',
      label: 'שם',
      type: 'text',
      required: true,
    },
    {
      name: 'group',
      label: 'קבוצה',
      type: 'select',
      options: [
        {
          value: '1',
          label: 'אסיפות שנתיות',
        },
        {
          value: '2',
          label: 'אסיפות מיוחדות',
        },
        {
          value: '3',
          label: 'אסיפות אג"ח',
        },
        {
          value: '4',
          label: 'אסיפות כתבי אופציה',
        },
        {
          value: '5',
          label: 'אסיפות תעודת סל',
        },
        {
          value: '6',
          label: 'יחידת השתתפות',
        },
        {
          value: '19',
          label: 'בוטלה',
        },
        {
          value: '20',
          label: 'נדחתה ללא מועד',
        },
        {
          value: '30',
          label: 'אג"ח כהונת נאמן',
        },
        {
          value: '-1',
          label: '---',
        },
      ],
    },
  ],
}
