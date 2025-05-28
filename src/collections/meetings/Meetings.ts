import { type CollectionConfig, PayloadRequest, SelectFieldSingleValidation } from 'payload'
import ProcessMeetingStateEndpoint from './endpoints/ProcessMeetingStateEndpoint'
import ProcessMeetingCompaniesEndPoint from './endpoints/ProcessMeetingCompaniesEndPoint'
import { allMeetingsEndpoint, futureMeetingsEndpoint } from './endpoints/MeetingsEndpoints'

import { IconLinkProps } from '@/admincomponents/link/IconLinkProps'
import { updateCompaniesMeetingsOnMeetingChange } from './hooks/updateCompaniesMeetings'
import uploadMeetingsCsvEndPoint from './feeds/uploadMeetingsCsvEndPoint'
import uploadMeetingsAgendaEndPoint from './feeds/uploadMeetingsAgendaEndPoint'
import { calculateHoldingDateHook } from './hooks/ calculateHoldingDate'
import {
  validateResearchDocsInMeetings,
  afterChangeDeleteResearchDocs,
  clearCompaniesInSingleBondResearchDoc,
  handleRecommendationReason,
} from '../research-documents/hooks'
import { getCollectionDoc } from '@/utils/utils'
import type { TextFieldSingleValidation } from 'payload'
const PropsManualLink: IconLinkProps = {
  urlTemplate: '${value}',
  iconUrl: '/link.ico', // You'll need to create this icon
  iconAltText: 'קישור ידני',
  iconOnly: true,
}

const validateMeetingInvitationLink: TextFieldSingleValidation = (
  value: string | null | undefined,
  options: any,
) => {
  if (options.req.context.from == 'migration') {
    return true
  }
  if (options.siblingData.magnaId || options.siblingData.invitationDocument || value) return true
  return 'יש להזין קישור לזימון, אסמכתא או מסמך זימון'
}
const validateMeetingState: SelectFieldSingleValidation = (
  value: string | null | undefined,
  options: any,
) => {
  if (!value) return true

  if (options.req.context.from == 'migration') {
    return true
  }
  const { siblingData } = options
  const currentDate = new Date()
  const meetingDate = siblingData.meetingDate ? new Date(siblingData.meetingDate) : null
  if (value == 'on-hold' && !meetingDate) return true

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
  }
  // Ensure we always return a valid value
  return true
}

// @ts-ignore
export const Meetings: CollectionConfig = {
  slug: 'meetings',
  labels: {
    plural: 'אסיפות',
    singular: 'אסיפה',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'fullName',
    listSearchableFields: ['fullName', 'magnaId', 'invitationLink', 'meetingId'],
    defaultColumns: [
      'fullName',
      'magnaId',
      'invitationLink',
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
      type: 'tabs',
      tabs: [
        {
          label: 'תוכן',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'stock',
                  label: 'נייר ערך',
                  type: 'relationship',
                  relationTo: 'stocks',
                  filterOptions: ({ siblingData }: any) => {
                    if (!siblingData?.meetingDate)
                      return {
                        active: {
                          equals: true,
                        },
                      }
                    const meetingDate = new Date(siblingData.meetingDate)
                    const currentDate = new Date()
                    const isFutureDate = meetingDate > currentDate
                    if (isFutureDate) {
                      return {
                        active: {
                          equals: true,
                        },
                      }
                    }
                    return true
                  },
                  index: true,
                  required: true,
                  admin: {
                    width: '30%',
                  },
                },
                {
                  name: 'type',
                  label: 'סוג',
                  index: true,
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
                {
                  name: 'meetingId',
                  label: 'מספר אסיפה',
                  type: 'text',
                  unique: true,
                  index: true,
                  admin: { width: '100px' },
                },
                {
                  name: 'fullName',
                  label: 'שם',
                  type: 'text', // Stored in the database
                  admin: {
                    hidden: true, // Hide in admin UI to prevent manual edits
                  },
                  index: true,
                  hooks: {
                    beforeChange: [
                      async ({ data, req }) => {
                        let stockName = ''
                        if (typeof data?.stock == 'string') {
                          const stock = await getCollectionDoc(req, 'stocks', data.stock, 0)
                          stockName = stock.fullName
                        }
                        return `${data?.type}-${stockName}`
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
                  name: 'magnaId',
                  label: 'אסמכתא',
                  type: 'text',
                  index: true,
                  admin: {
                    width: '200px',
                  },
                },
                {
                  name: 'invitationDocument',
                  label: 'מסמך זימון',
                  type: 'upload',
                  relationTo: 'documents',
                  admin: {
                    className: 'invitationDocument',
                    width: '200px',
                  },
                },
                {
                  name: 'invitationLink',
                  label: 'קישור לזימון',
                  type: 'text',
                  index: true,
                  admin: {
                    width: '600px',
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
                  validate: validateMeetingInvitationLink,
                  hooks: {
                    afterRead: [
                      async ({ data, req }) => {
                        if (data?.invitationDocument) {
                          const document = await req.payload.findByID({
                            collection: 'documents',
                            id: data.invitationDocument,
                          })
                          return `${document.url}`
                        }
                        if (data?.magnaId && !data?.invitationLink) {
                          return `https://www.magna.isa.gov.il/details?id=${data.magnaId}&file=0`
                        }
                        if (data?.invitationLink) {
                          return data.invitationLink
                        }
                        return null
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
                  index: true,
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
                  hooks: {
                    beforeChange: [calculateHoldingDateHook],
                  },
                },
                {
                  name: 'meetingDate',
                  label: 'מועד האסיפה',
                  type: 'date',
                  index: true,
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
                      ({ siblingData, value }) => {
                        if (value === 'on-hold') {
                          siblingData.meetingDate = null
                        }
                        return value
                      },
                    ],
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
          ],
        },
        {
          label: 'סדר יום',
          fields: [
            {
              name: 'agenda',
              label: 'נושאים',
              type: 'array',
              interfaceName: 'MeetingAgenda',
              labels: {
                singular: 'נושא',
                plural: 'נושאים',
              },
              admin: {
                initCollapsed: true,
                components: {
                  RowLabel: '/collections/meetings/components/RowLabel#SubjectLabel',
                  Label: '/collections/meetings/components/RowLabel#ArrayLabel',
                },
              },
              fields: [
                {
                  name: 'text',
                  label: 'תוכן הנושא',
                  type: 'textarea',
                  required: true,
                  admin: {
                    className: 'agendaText',
                    style: { minHeight: '37px' },
                  },
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'shortText',
                      label: 'נושא מקוצר',
                      type: 'text',
                    },
                    {
                      name: 'isRemovedFromAgenda',
                      label: 'הוסר מסדר היום',
                      type: 'checkbox',
                      admin: { width: '200px' },
                    },
                    {
                      name: 'topicType',
                      label: 'סוג נושא',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'לדיווח בלבד', value: 'reporting' },
                        { label: 'להחלטה', value: 'decision' },
                      ],
                      admin: {
                        width: '200px',
                      },
                    },
                    {
                      name: 'majorityType',
                      label: 'סוג רוב נדרש',
                      type: 'select',
                      options: [
                        { label: 'רוב רגיל', value: 'regular' },
                        { label: 'רוב מיוחד', value: 'privileged' },
                      ],
                      admin: {
                        width: '200px',
                        condition: (_, siblingData) => {
                          return siblingData.topicType === 'decision'
                        },
                      },
                    },
                  ],
                },
                {
                  name: 'recommendation',
                  label: 'המלצה',
                  type: 'group',
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'votingRecommendation',
                          label: 'המלצת הצבעה',
                          type: 'select',
                          admin: {
                            width: '10%',
                          },
                          options: [
                            { label: 'בעד', value: 'for' },
                            { label: 'נגד', value: 'against' },
                            { label: 'נמנע', value: 'abstain' },
                            /*                            { label: '----', value: '----' },*/
                          ],
                        },
                        {
                          name: 'recommendation',
                          label: 'נימוק המלצה',
                          type: 'text',
                          admin: {
                            width: '90%',
                          },
                        },
                      ],
                    },
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'checkbox',
                          label: 'האם יש המלצה חריגה?',
                          type: 'checkbox',
                          admin: {
                            width: '20%',
                          },
                        },
                        {
                          name: 'exceptionalRecommendationVote',
                          label: 'המלצה חריגה',
                          type: 'select',
                          admin: {
                            width: '10%',
                            condition: (_, siblingData) => siblingData?.checkbox === true,
                          },
                          options: [
                            { label: 'בעד', value: 'for' },
                            { label: 'נגד', value: 'against' },
                            { label: 'נמנע', value: 'abstain' },
                          ],
                        },
                        {
                          name: 'companies',
                          label: 'חברות',
                          type: 'relationship',
                          relationTo: 'companies',
                          hasMany: true,
                          admin: {
                            width: '70%',
                            condition: (_, siblingData) => siblingData?.checkbox === true,
                          },
                        },
                      ],
                    },
                    {
                      type: 'row',
                      admin: {
                        condition: (_, siblingData) => siblingData?.checkbox === true,
                      },
                      fields: [
                        {
                          name: 'reasonRef',
                          label: 'נימוק מוכן',
                          type: 'relationship',
                          relationTo: 'reasons',
                          admin: {
                            width: '60%',
                          },
                        },
                        {
                          name: 'reasonText',
                          label: 'נימוק (נבחר או חופשי)',
                          type: 'textarea',
                          admin: {
                            width: '40%',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  name: 'vpercent',
                  label: 'אחוז הצבעה',
                  type: 'number',
                  admin: {
                    hidden: true,
                    step: 0.01,
                    condition: (_, siblingData) =>
                      siblingData.topicType === 'decision' &&
                      siblingData.majorityType === 'regular',
                  },
                },
                {
                  name: 'vPercentSpecial',
                  label: 'אחוז הצבעה מיוחד',
                  type: 'number',
                  admin: {
                    hidden: true,
                    step: 0.01,
                    condition: (_, siblingData) =>
                      siblingData.topicType === 'decision' &&
                      siblingData.majorityType === 'privileged',
                  },
                },
                {
                  name: 'result',
                  label: 'תוצאה',
                  type: 'select',
                  options: [
                    { label: '---', value: '0' },
                    { label: 'בעד', value: '1' },
                    { label: 'נגד', value: '2' },
                    { label: 'דיון', value: '3' },
                  ],
                  admin: {
                    hidden: true,
                    condition: (_, siblingData) => siblingData.topicType === 'decision',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'הצבעות',
          fields: [
            {
              name: 'votes',
              label: 'הצבעות',
              type: 'join',
              collection: 'votes',
              on: 'meeting',
              defaultLimit: 0,
              maxDepth: 0,
              admin: {
                defaultColumns: ['companies', 'votes'],
              },
            },
          ],
        },
        {
          label: 'חברות',
          fields: [
            {
              type: 'relationship',
              relationTo: 'companies',
              hasMany: true,
              name: 'companies',
              label: 'חברות',
              index: true,
              maxDepth: 0,
              admin: {
                readOnly: true,
              },
            },
            {
              name: 'companiesWithHolding',
              type: 'array',
              admin: {
                hidden: true,
              },
              fields: [
                {
                  name: 'company',
                  type: 'relationship',
                  relationTo: 'companies',
                  hasMany: false,
                  label: 'חברה',
                  maxDepth: 1,
                },
                {
                  name: 'holding',
                  type: 'relationship',
                  relationTo: 'holdings',
                  hasMany: false,
                  maxDepth: 1,
                },
              ],
            },
            {
              name: 'stockValue',
              type: 'relationship',
              relationTo: 'stock-values',
              hasMany: false,
              admin: {
                hidden: true,
              },
              maxDepth: 1,
            },
          ],
        },
        {
          label: 'מסמכי מחקר',
          fields: [
            {
              name: 'researchDocuments',
              label: 'מסמך מחקר',
              type: 'upload',
              relationTo: 'research-documents',
              hasMany: true,
              admin: {
                components: {
                  Field: '/collections/meetings/components/ResearchUploadDisplay',
                },
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async ({ req, doc, previousDoc }) => {
        const holdingsLimitChanged =
          previousDoc?.holdingsLimit?.toString() !== doc?.holdingsLimit?.toString()
        const stockChanged = previousDoc?.stock !== doc?.stock

        if (holdingsLimitChanged || stockChanged) {
          if (req.context?.from !== 'process' && req.context?.from !== 'migration') {
            await updateCompaniesMeetingsOnMeetingChange(req, doc)
          }
        }
      },
      afterChangeDeleteResearchDocs,
    ],

    beforeValidate: [validateResearchDocsInMeetings],
    beforeChange: [handleRecommendationReason, clearCompaniesInSingleBondResearchDoc],
  },
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
    {
      path: '/upload-meetings-csv',
      method: 'post',
      handler: uploadMeetingsCsvEndPoint,
    },
    {
      path: '/upload-meetings-agenda',
      method: 'post',
      handler: uploadMeetingsAgendaEndPoint,
    },
    {
      path: '/future-meetings',
      method: 'get',
      handler: futureMeetingsEndpoint,
    },
    {
      path: '/all-meetings',
      method: 'get',
      handler: allMeetingsEndpoint,
    },
  ],
}
