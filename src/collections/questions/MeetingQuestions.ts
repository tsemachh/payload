import { meetingTypeOptions } from '@/consts/otipns-const'
import { CollectionConfig } from 'payload'

export const MeetingQuestions: CollectionConfig = {
  slug: 'questions',
  labels: {
    singular: 'שאלות לאסיפה',
    plural: ' שאלות לאסיפות',
  },

  admin: {
    useAsTitle: 'title',
    group: 'ניהול',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },

  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'title',
          label: 'כותרת',
          type: 'text',
          unique: true,
          admin: {
            width: '50%',
            components: {
              Field: '/collections/questions/components/TitleField',
            },
          },
        },
        {
          name: 'type',
          label: 'סוג',
          type: 'select',
          interfaceName: 'MeetingType',
          required: true,
          index: true,
          options: meetingTypeOptions,
          admin: {
            width: '30%',
          },
        },
        {
          name: 'autoFillInMeetings',
          label: 'מילוי אוטומטי',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            width: '20%',
            description: 'האם למלא אוטומטית באסיפות מאותו סוג',
          },
        },
      ],
    },

    {
      name: 'questions',
      label: 'שאלות',
      type: 'array',

      admin: {
        components: {
          RowLabel: {
            path: '/collections/questions/components/rowLabel',
          },
        },
      },

      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'questionText',
              label: 'שאלה',
              type: 'text',
              required: true,
              admin: {
                width: '85%',
              },
            },

            {
              name: 'defaultValue',
              label: 'ברירת מחדל',
              type: 'select',
              options: [
                { label: 'לא', value: 'false' },
                { label: 'כן', value: 'true' },
              ],
              defaultValue: 'false',
              admin: {
                width: '15%',
              },
            },
          ],
        },
      ],
    },
  ],
}
