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
      name: 'meetingId',
      label: 'מזהה אסיפה',
      type: 'number',
      unique: true,
      required: true,
      index: true
    },
    {
      name: 'proofId',
      label: 'אסמכתא',
      type: 'text',
      maxLength: 20,
      admin: {
        description: 'Reference ID for official meeting documentation'
      },
    },
    {
      name: 'meetingDate',
      label: 'מועד האסיפה',
      type: 'date',
      admin: {
        description: 'Actual meeting date and time'
      },
    },
    {
      name: 'holdingsLimit',
      label: 'תאריך קובע',
      type: 'date',
      admin: {
        description: 'The date which tells when we check the holders which are obilgated to attend the meeting'
      },
    },
    {
      name: 'proxyStatementDate',
      label: 'מועד מסירת ההצבעה',
      type: 'date',
      admin: {
        description: 'Max Date when proxy voting should be submitted'
      },
    },
    {
      name: 'stock',
      label: 'נייר ערך',
      type: 'relationship',
      relationTo: 'stocks',
    },
    {
      name: 'votingDocUrl',
      label: 'כתב הצבעה',
      type: 'text',
      admin: {
        description: 'קישור לכתב הצבעה'
      },
    },
    {
      name: 'meetingInviteUrl',
      label: 'זימון אסיפה',
      type: 'text',
      admin: {
        description: 'קישור לזימון אסיפה'
      },
    },
    {
      name: 'location',
      label: 'מיקום',
      type: 'text',
    },
    {
      name: 'meetingType',
      label: 'סוג',
      type: 'relationship',
      relationTo: 'meeting-types',
    },
    {
      name: 'comments',
      label: 'הערות',
      type: 'textarea',
    },
    {
      name: 'resultsConfirmationStatus',
      label: 'אימות תוצאות האסיפה',
      type: 'checkbox',
      admin: {
        description: 'אימות תוצאות האסיפה'
      },
    },
    {
      name: 'electronicVotingEnabled',
      label: 'האם האסיפה מופיעה במערכת האלקטרונית?',
      type: 'checkbox',
      admin: {
        description: 'האסיפה מופיעה במערכת האלקטרונית?'
      },
    },
    {
      name: 'relatedMeetingId',
      label: 'אסיפה קשורה',
      type: 'relationship',
      relationTo: "meetings",
      admin: {
        description: 'ID of related meeting (for continued or postponed sessions)'
      },
    },
    {
      name: 'committeeInitiated',
      label: 'האם פיננסי דורש ועדה?',
      type: 'checkbox',
      admin: {
        description: 'פיננסי דורש ועדה'
      },
    },
  ]
}