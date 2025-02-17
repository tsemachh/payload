import type { CollectionConfig } from 'payload'

export const Meetings: CollectionConfig = {
  slug: 'meetings',
  labels: {
    plural: 'אסיפות',
    singular: 'אסיפה',
  },
  admin: {
    useAsTitle: 'meetingId',
    defaultColumns: ['meetingId', 'meetingDate'],
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
          index: true,
        },
        {
          name: 'proofId',
          label: 'אסמכתא',
          type: 'text',
          maxLength: 20,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'meetingDate',
          label: 'תאריך האסיפה',
          type: 'date',
        },
        {
          name: 'holdingsLimit',
          label: 'יום קובע',
          type: 'date',
        },
        {
          name: 'proxyStatementDate',
          label: 'תאריך מסירת ההצבעות',
          type: 'date',
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'stock',
          label: "מס' נייר ערך",
          type: 'relationship',
          relationTo: 'stocks',
        },
        {
          name: 'votingDocUrl',
          label: 'קישור לכתב הצבעה',
          type: 'text',
        },
        {
          name: 'meetingInviteUrl',
          label: 'זימון אסיפה',
          type: 'text',
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
          label: 'סןג אסיפה',
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
        {
          name: 'relatedMeetingId',
          label: 'אסיפה קשורה',
          type: 'relationship',
          relationTo: 'meetings',
        },
      ],
    },
  ],
}
