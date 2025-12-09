import { meetingTypeOptions } from "@/consts/otipns-const";
import { CollectionConfig } from "payload";

export const Questions: CollectionConfig = {
  slug: 'questions',
  labels: {
    singular: 'שאלה',
    plural: 'שאלות',
  },

  admin: {
    useAsTitle: 'type',
    group: 'ניהול',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },

  fields: [
    {
      name: 'type',
      label: 'סוג',
      type: 'select',
      interfaceName: 'MeetingType',
      required: true,
      index: true,
      options: meetingTypeOptions,
      admin: {
        custom: {
          cellWidth: '50px',
        },
        width: '30px',
      },
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
              admin: {
                width: '85%',
              },
            },

            {
              name: 'defaultValue',
              label: 'ערך דיפולטיבי',
              type: 'checkbox',
              admin: {
                width: '15%',
              },
            },
          ],
        },
      ],
    },
  ],
};
