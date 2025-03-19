import type { CollectionConfig } from 'payload'
import ProcessMeetingStateEndpoint from './endpoints/ProcessMeetingStateEndpoint'
import ProcessMeetingCompaniesEndPoint from './endpoints/ProcessMeetingCompaniesEndPoint'

import { IconLinkProps } from '@/admincomponents/link/IconLinkProps'
import { updateCompaniesMeetingsOnMeetingChange } from './hooks/updateCompaniesMeetings'

const PropsManualLink: IconLinkProps = {
  urlTemplate: '${value}',
  iconUrl: '/link.ico', // You'll need to create this icon
  iconAltText: 'קישור ידני',
}

const validateMeetingState = (value: string | null | undefined, options: any) => {
  if (!value) return true

  const { siblingData } = options
  const currentDate = new Date()
  const meetingDate = siblingData.meetingDate ? new Date(siblingData.meetingDate) : null
  if (value == "on-hold" && !meetingDate)
    return true

  if (!meetingDate) {
    return 'יש לספק מועד אסיפה'
  }
  if (meetingDate) {
     switch (value) {
    case 'completed':
      if (meetingDate > currentDate) {
        return 'מצב ״התקיימה״ מתאפשר רק לאסיפות שמועדן בעבר'
      }
      break

    case 'postponed':
      if (meetingDate < currentDate) {
        return 'מצב ״נדחית״ מתאפשר רק לאסיפות שמועדן בעתיד'
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

export const Meetings: CollectionConfig = {
  slug: 'meetings',
  labels: {
    plural: 'אסיפות',
    singular: 'אסיפה',
  },
  admin: {
    useAsTitle: 'meetingId',
    listSearchableFields: ['magnaId',
      'stock',
      'type',
      'holdingsLimit',
      'proxyVotingDate',
      'meetingDate',
      'state'],
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
  hooks: {
    afterChange: [
      async ({ req, doc }) => {
        await updateCompaniesMeetingsOnMeetingChange(req, doc)
      },
    ],

  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'meetingId',
          label: 'מספר אסיפה',
          type: 'text',
          unique: true,
          index: true,
          admin: { hidden: true },

        },
        {
          name: 'stock',
          label: 'נייר ערך',
          type: 'relationship',
          relationTo: 'stocks',
          index: true,
          required: true,
          admin: {
            width: '30%',
          },
        },
        {
          name: 'magnaId',
          label: 'אסמכתא',
          type: 'text',
          index: true,
          admin: {
            width: '20%',
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
          admin: {
            width: '15%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'invitationDocument',
          label: 'מסמך זימון',
          type: 'upload',
          relationTo: 'documents',
          admin: {
            width: '18%',
          },
        },
        {
          name: 'invitationLink',
          label: 'קישור לזימון',
          type: 'text',
          admin: {
            width: '40%',
            components: {
              Cell: {
                path: '/admincomponents/link/IconLinkCell',
                clientProps: PropsManualLink,
              },
              Field: {
                path: '/admincomponents/link/IconLinkTextField',
                clientProps: PropsManualLink,
              },
            },
          },
          hooks: {
            afterRead: [
              async ({ data ,req}) => {
                if (data?.invitationDocument) {
                  const document = await req.payload.findByID({
                    collection: 'documents',
                    id: data.invitationDocument,
                  });
                  return `${process.env.SERVER_URL}${document.url}`;
                }
               if (data?.magnaId && !data?.invitationLink) {
                  return `https://www.magna.isa.gov.il/details?id=${data.magnaId}&file=0`;
                }
                if (data?.invitationLink) {
                  return data.invitationLink;
                }
                return null;
              },
            ],
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
        },
        {
          name: 'state',
          label: 'מצב',
          type: 'select',
          hooks: {
            beforeChange: [
              ({ siblingData,value }) => {
                if (value === 'on-hold') {
                  siblingData.meetingDate =null
                }
                return value
              }
            ],
          },
          interfaceName: 'MeetingState',
          // @ts-expect-error
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
        },
        {
          name: 'electronicVotingEnabled',
          label: 'האם מופיעה במערכת האלק׳?',
          type: 'checkbox',
        },
        {
          name: 'committeeInitiated',
          label: 'האם פיננסי דורש ועדה?',
          type: 'checkbox',
        },
      ],
    },
    {
      type:'relationship',
      relationTo: 'companies',
      hasMany: true,
      name: 'companies',
      label: 'חברות'
    }
  ],
  endpoints: [
    {
      path: '/process-meetings',
      method: 'post',
      handler: ProcessMeetingStateEndpoint,
    },
    {
      path: '/process-companies',
      method: 'post',
      handler: ProcessMeetingCompaniesEndPoint,
    },
  ],
}
