import type { CollectionConfig } from 'payload'
import { IconLinkProps } from '../../components/link/IconLinkProps'
import ProcessMeetingsEndpoint from './endpoints/ProcessMeetingsEndpoint'
import { Meeting } from '@/payload-types'

const meetingLinkProps: IconLinkProps = {
  urlTemplate: 'https://www.magna.isa.gov.il/details?id=${value}&file=0',
  iconUrl: '/faviconMagna.ico',
  iconAltText: 'קישור למגנא',
}

const validateMeetingState = (value: string | null | undefined, options: any) => {
  if (!value) return true

  const { siblingData } = options
  const currentDate = new Date()
  const meetingDate = siblingData.meetingDate ? new Date(siblingData.meetingDate) : null

  if (meetingDate) {
     switch (value) {
    case 'completed':
      if (meetingDate > currentDate) {
        return 'מצב ״התקיימה״ מתאפשר רק לאסיפות שמועדן בעבר'
      }
      break

    case 'postponed':
      if (meetingDate < currentDate) {
        return 'מצב ״נדחית״ מתאפשר רק אם מועד האסיפה הוזז למועד מאוחר יותר'
      }
      break

    case 'scheduled':
      if (meetingDate < currentDate) {
        return 'מצב ״מתוכננת״ מתאפשר רק לאסיפות שמועדן בעתיד'
      }
      break

    case 'ongoing':
      if (meetingDate < currentDate) {
        return 'מצב ״נמשכת״ מתאפשר רק לאסיפות שמועדן בעתיד'
      }
      break
  }
     return true
}}

// Function to check if document should be read-only
const getReadOnlyAccess = ({ data}) => {
   if(data?.state === 'completed' || data?.state === 'cancelled')
     return false
  return true
}
// Function to check if document should be read-only
const getReadOnlyAccessMeetingDate = ({ data}) => {
  if(data?.state === 'on-hold' || data?.state === 'completed' || data?.state === 'cancelled')
    return false
  return true
}

export const Meetings: CollectionConfig = {
  slug: 'meetings',
  labels: {
    plural: 'אסיפות',
    singular: 'אסיפה',
  },
  admin: {
    useAsTitle: 'meetingId',
    defaultColumns: [
      'magnaId',
      'stock',
      'type',
      'holdingsLimit',
      'proxyVotingDate',
      'meetingDate',
      'state',
    ],
    pagination: {
      defaultLimit: 500,
      limits: [10, 20, 50, 100, 200, 500],
    },
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
          label: 'מספר אסיפה',
          type: 'number',
          unique: true,
          required: true,
          index: true,
          admin: { hidden: true },
          access: {
            update: getReadOnlyAccess
          },
        },
        {
          name: 'magnaId',
          label: 'אסמכתא',
          type: 'text',
          maxLength: 20,
          admin: {
            components: {
              Cell: {
                path: '/components/link/IconLinkCell',
                clientProps: meetingLinkProps,
              },
              Field: {
                path: '/components/link/IconLinkTextField',
                clientProps: meetingLinkProps,
              },
            },
          },
          access: {
            update: getReadOnlyAccess
          },
        },
        {
          name: 'stock',
          label: 'נייר ערך',
          type: 'relationship',
          relationTo: 'stocks',
          index: true,
          access: {
            update: getReadOnlyAccess
          },
        },
        {
          name: 'type',
          label: 'סוג',
          type: 'select',
          interfaceName: 'MeetingType',
          options: [
            { label: 'שנתית', value: 'שנתית' },
            { label: 'מיוחדת', value: 'מיוחדת' },
            { label: 'אג"ח', value: 'אג"ח' },
            { label: 'אופציה', value: 'אופציה' },
            { label: 'יחידת השתתפות', value: 'יחידת השתתפות' },
            { label: 'תעודת סל', value: 'תעודת סל' },
            { label: 'אג"ח כהונת נאמן', value: 'אג"ח כהונת נאמן' },
          ],
          access: {
            update: getReadOnlyAccess
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'holdingsLimit',
          label: 'מועד קובע',
          type: 'date',
          admin: {
            date: {
              displayFormat: 'dd/MM/yyyy',
              pickerAppearance: 'default',
            },
          },
          access: {
            update: getReadOnlyAccess
          },
        },
        {
          name: 'proxyVotingDate',
          label: 'מועד מסירת ההצבעות',
          type: 'date',
          index: true,
          admin: {
            date: {
              displayFormat: 'HH:mm dd/MM/yyyy',
              pickerAppearance: 'dayAndTime',
            },
          },
          access: {
            update: getReadOnlyAccess
          },
        },
        {
          name: 'meetingDate',
          label: 'מועד האסיפה',
          type: 'date',
          admin: {
            date: {
              displayFormat: 'HH:mm dd/MM/yyyy',
              pickerAppearance: 'dayAndTime',
            },
            description: (data) => data?.state === 'on-hold' ? 'מועד האסיפה לא זמין במצב ״נדחית ללא מועד״' : undefined,
          },
          access: {
            update: getReadOnlyAccessMeetingDate
          },
          hooks: {
            beforeChange: [
              ({ siblingData,value }) => {
                // Handle meetingDate when state is on-hold
                if (siblingData.state === 'on-hold') {
                  console.log(`-------data ${siblingData}`)
                  console.log(`-------data.state ${siblingData.state}`)
                  return null
                }
                return value
              }
            ],
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'location',
          label: 'כתובת',
          type: 'text',
          access: {
            update: getReadOnlyAccess
          },
        },
        {
          name: 'state',
          label: 'מצב',
          type: 'select',
          access: {
            update: getReadOnlyAccess
          },
          interfaceName: 'MeetingState',
          validate: validateMeetingState,
          options: [
            { label: 'מתוכננת', value: 'scheduled' },
            { label: 'התקיימה', value: 'completed' },
            { label: 'נדחית', value: 'postponed' },
            { label: 'נדחית ללא מועד', value: 'on-hold' },
            { label: 'נמשכת', value: 'ongoing' },
            { label: 'בוטלה', value: 'cancelled' },
          ],
        },
      ],
    },
    {
      name: 'comments',
      label: 'הערות',
      type: 'textarea',
      access: {
        update: getReadOnlyAccess
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'resultsConfirmationStatus',
          label: 'אימות תוצאות',
          type: 'checkbox',
          admin: {
            condition: (siblingData) => siblingData.state === 'completed',
          },
          access: {
            update: getReadOnlyAccess
          },
        },
        {
          name: 'electronicVotingEnabled',
          label: 'האם מופיעה במערכת האלק׳?',
          type: 'checkbox',
          access: {
            update: getReadOnlyAccess
          },
        },
        {
          name: 'committeeInitiated',
          label: 'האם פיננסי דורש ועדה?',
          type: 'checkbox',
          access: {
            update: getReadOnlyAccess
          },
        },
      ],
    },
  ],
  endpoints: [
    {
      path: '/process-meetings',
      method: 'post',
      handler: ProcessMeetingsEndpoint,
    },
  ],
}