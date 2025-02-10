import type { CollectionConfig } from 'payload'

export const Meetings: CollectionConfig = {
  slug: 'meetings',
  labels: {
    plural: 'אסיפות',
    singular: 'אסיפה',
  },
  admin: {
    useAsTitle: 'meetingId',
    defaultColumns: ['meetingId', 'meetingDate', 'meetingType'],
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
          admin: {
            description: 'Reference ID for official meeting documentation',
          },
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
          admin: {
            description: 'Actual meeting date and time',
          },
        },
        {
          name: 'holdingsLimit',
          label: 'יום קובע',
          type: 'date',
          admin: {
            description:
              'The date which tells when we check the holders which are obligated to attend the meeting',
          },
        },
        {
          name: 'proxyStatementDate',
          label: 'תאריך מסירת ההצבעות',
          type: 'date',
          admin: {
            description: 'Max Date when proxy voting should be submitted',
          },
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
          admin: {
            description: 'קישור לכתב הצבעה',
          },
        },
        {
          name: 'meetingInviteUrl',
          label: 'זימון אסיפה',
          type: 'text',
          admin: {
            description: 'קישור לזימון אסיפה',
          },
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
          name: 'meetingType',
          label: 'סוג האסיפה',
          type: 'relationship',
          relationTo: 'meeting-types',
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
            description: 'אימות תוצאות האסיפה',
          },
        },
        {
          name: 'electronicVotingEnabled',
          label: 'האם האסיפה מופיעה במערכת האלקטרונית?',
          type: 'checkbox',
          admin: {
            description: 'האסיפה מופיעה במערכת האלקטרונית?',
          },
        },
        {
          name: 'relatedMeetingId',
          label: 'אסיפה קשורה',
          type: 'relationship',
          relationTo: 'meetings',
          admin: {
            description: 'ID of related meeting (for continued or postponed sessions)',
          },
        },
        {
          name: 'committeeInitiated',
          label: 'האם פיננסי דורש ועדה?',
          type: 'checkbox',
          admin: {
            description: 'פיננסי דורש ועדה',
          },
        },
      ],
    },
  ],
}
