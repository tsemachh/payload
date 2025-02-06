import type { CollectionConfig } from 'payload'

export const Meetings: CollectionConfig = {
  slug: 'meetings',
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
      type: 'number',
      unique: true, // Ensure meetingId is unique
      required: true,
      index : true
    },
    {
      name: 'proofId', //proofId
      type: 'text',
      maxLength: 20,
      admin: {
        description: 'Reference ID for official meeting documentation',
      },
    },
    {
      name: 'meetingDate', //mdate
      type: 'date',
      required: true,
      admin: {
        description: 'Actual meeting date and time',
      },
    },
    {
      name: 'startDate', //sdate
      type: 'date',
      admin: {
        description: 'Start date for meeting-related activities',
      },
    },
    {
      name: 'proxyMaterialsDate', //proxyStatementDate
      type: 'date',
      admin: {
        description: 'Date when proxy voting materials were issued',
      },
    },
    {
      name: 'stock', //-stockID
      type: 'relationship',
      relationTo: 'stocks',
      required: true,
    },
    {
      name: 'primaryDocumentUrl', //-memourl
      type: 'text',
      admin: {
        description: 'URL to primary meeting documentation',
      },
    },
    {
      name: 'supplementaryDocumentUrl', //-link2
      type: 'text',
      admin: {
        description: 'URL to supplementary meeting documentation',
      },
    },
    {
      name: 'location', //location
      type: 'text',
      required: true,
    },
    {
      name: 'meetingType', //-mtype
      type: 'relationship',
      relationTo: 'meeting-types',
      required: true,
    },
    {
      name: 'comments', //comments
      type: 'textarea',
    },
   /* {
      name: 'recommendation',
      type: 'upload',
      relationTo: 'media',
      filterOptions: {
        type: { equals: "recommendation" }
      }
    },*/
    {
      name: 'resultsConfirmationStatus', //-ResultConfirm ??
      type: 'checkbox',
    },
    {
      name: 'electronicVotingEnabled', //-ElectronicVoting
      type: 'checkbox'
    },
    {
      name: 'relatedMeetingId', //mIdConnection
      type: 'relationship',
      relationTo :"meetings",
      admin: {
        description: 'ID of related meeting (for continued or postponed sessions)',
      },
    },
    {
      name: 'committeeInitiated', //CommiteeRequest
      type: 'checkbox'
    },
  ]
}