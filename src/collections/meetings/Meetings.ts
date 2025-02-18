import type { CollectionConfig } from 'payload'
export const Meetings: CollectionConfig = {
  slug: 'meetings',
  labels: {
    plural: 'אסיפות',
    singular: 'אסיפה',
  },
  admin: {
    useAsTitle: 'meetingId',
    defaultColumns: ['magnaId', 'stock', 'proxyVotingDate', 'meetingDate', 'type', 'state'],
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'meetingId',
          label: "מס' אסיפה",
          type: 'number',
          unique: true,
          required: true,
          admin: { hidden: true },
        },
        {
          name: 'magnaId',
          label: 'אסמכתא',
          type: 'text',
          maxLength: 20,
        },
        // {
        //   name: 'meetingLink',
        //   label: 'Meeting Link',
        //   type: 'text',
        //   admin: {
        //     components: {
        //       Field: {
        //         path: '/components/link/LinkFromRelationField',
        //         clientProps: {
        //           relationField: 'magnaId',
        //           baseUrl: 'https://www.magna.isa.gov.il/details?id=',
        //           suffix: '&file=0',
        //         },
        //       },
        //     },
        //   },
        // },
        {
          name: 'state',
          label: 'מצב האסיפה',
          type: 'select',
          options: [
            { label: 'מתוכננת', value: 'scheduled' },
            { label: 'התקיימה', value: 'completed' },
            { label: 'נדחית', value: 'postponed' },
            { label: 'נדחית ללא מועד', value: 'on-hold' },
            { label: 'נמשכת', value: 'ongoing' },
            { label: 'בוטלה', value: 'cancelled' },
          ],
        },
        {
          name: 'stock',
          label: 'נייר ערך',
          type: 'relationship',
          relationTo: 'stocks',
          index:true
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'meetingDate',
          label: 'מועד האסיפה	',
          type: 'date',
        },
        {
          name: 'holdingsLimit',
          label: 'מועד קובע',
          type: 'date',
          admin: {
            date: {
              displayFormat: 'dd MMM yyy',
              pickerAppearance: 'default',
            },
          },
        },
        {
          name: 'proxyVotingDate',
          label: 'מועד מסירת ההצבעות',
          type: 'date',
          index: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'location',
          label: 'כתובת האסיפה',
          type: 'text',
        },
        {
          name: 'type',
          label: 'סוג',
          type: 'select',
          options: [
            { label: 'שנתית', value: 'שנתית' },
            { label: 'מיוחדת', value: 'מיוחדת' },
            { label: 'אג"ח', value: 'אג"ח' },
            { label: 'אג"ח נמשכת', value: 'אג"ח נמשכת' },
            { label: 'אופציה', value: 'אופציה' },
            { label: 'יחידת השתתפות', value: 'יחידת השתתפות' },
            { label: 'תעודת סל', value: 'תעודת סל' },
            { label: 'אג"ח כהונת נאמן', value: 'אג"ח כהונת נאמן' },
          ],
          
        },
        {
          name: 'comments',
          label: 'הערות',
          type: 'textarea',
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'resultsConfirmationStatus',
          label: 'אימות תוצאות האסיפה',
          type: 'checkbox',
          admin: {
            condition: (siblingData) => siblingData.state === 'completed',
          },
        },
        {
          name: 'electronicVotingEnabled',
          label: 'האם האסיפה מופיעה במערכת האלקטרונית?',
          type: 'checkbox',
        },
        {
          name: 'committeeInitiated',
          label: 'האם פיננסי דורש ועדה?',
          type: 'checkbox',
        },
      ],
    },
  ],
}
