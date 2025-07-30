import type { Field } from 'payload'
import { type CollectionConfig } from 'payload'
import ProcessMeetingStateEndpoint from './endpoints/ProcessMeetingStateEndpoint'
import ProcessMeetingCompaniesEndPoint from './endpoints/ProcessMeetingCompaniesEndPoint'
import {
  allMeetingsEndpoint,
  futureMeetingsEndpoint,
  meetingForVotingEndPoint,
} from './endpoints/MeetingsEndpoints'
import { IconLinkProps } from '@/admincomponents/link/IconLinkProps'
import { updateCompaniesMeetingsOnMeetingChange } from './hooks/updateCompaniesMeetings'
import uploadMeetingsCsvEndPoint from './feeds/uploadMeetingsCsvEndPoint'
import uploadMeetingsAgendaEndPoint from './feeds/uploadMeetingsAgendaEndPoint'
import { calculateHoldingDateHook } from './hooks/calculateHoldingDate'
import {
  afterChangeDeleteResearchDocs,
  clearCompaniesInSingleBondResearchDoc,
  handleRecommendationReason,
  validateResearchDocsInMeetings,
} from '../research-documents/hooks'
import { getCollectionDoc, getIdOfRelationField } from '@/utils/utils'
import { syncDualMeeting } from './hooks/syncDualMeeting'
import {
  beforeChangeMeetingId,
  validateMeetingInvitationLink,
  validateMeetingState,
} from '@/collections/meetings/hooks/adminHooks'
import { meetingStateOptions, meetingTypeOptions } from '@/consts/otipns-const'
import { updateVoteStatusOnCompaniesChange } from '@/collections/meetings/hooks/votesCountHooks'

const PropsManualLink: IconLinkProps = {
  urlTemplate: '${value}',
  iconUrl: '/link.ico', // You'll need to create this icon
  iconAltText: 'קישור ידני',
  iconOnly: true,
}

const votingRecommendation = [
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
          { label: '----', value: '----' },
          { label: 'בעד', value: 'בעד' },
          { label: 'נגד', value: 'נגד' },
          { label: 'נמנע', value: 'נמנע' },
          { label: 'דיון', value: 'דיון' },
        ],
      },
      {
        name: 'reasonRef',
        label: 'נימוק מערכת',
        type: 'text',
        defaultValue: null,
        hasEmptyOption: true,
        admin: {
          width: '90%',
          components: {
            Field: '/collections/meetings/components/RecommendationReasonSelect',
          },
        },
      },
      {
        name: 'reasonText',
        label: 'נימוק חופשי',
        type: 'text',
        admin: {
          width: '100%',
          components: {
            Field: '/collections/meetings/components/ConditionalReasonText',
          },
        },
      },
    ],
  },
]
const votingRecommendationExceptional = JSON.parse(JSON.stringify(votingRecommendation))
votingRecommendationExceptional.forEach((row: Field) => {
  row.admin = { condition: (_, siblingData) => siblingData?.showExceptional === true }
})

export const Meetings: CollectionConfig = {
  slug: 'meetings',
  labels: {
    plural: 'אסיפות',
    singular: 'אסיפה',
  },
  custom: {
    filterList: [
      [
        { name: 'meetingDate' },
        { name: 'holdingsLimit' },
        { name: 'proxyVotingDate' },
        { name: 'state', width: '200px' },
        { name: 'type', width: '200px' },
      ],
      [
        { name: 'resultsConfirmationStatus' },
        { name: 'electronicVotingEnabled' },
        { name: 'votesStatus' },
        { name: 'votesReportStatus' },
        { name: '_status' },
      ],
    ],
  },
  enableQueryPresets: true,
  defaultSort: 'meetingDate',
  admin: {
    useAsTitle: 'fullName',
    group: 'פעילות',

    listSearchableFields: ['fullName', 'magnaId', 'invitationLink', 'meetingId'],
    defaultColumns: [
      'fullName',
      'type',
      'meetingDate',
      'holdingsLimit',
      'proxyVotingDate',
      'votesCount',
      'reportVotesCount',
      'votesStatus',
      'votesReportStatus',
      'electronicVotingEnabled',
      'invitationLink',
    ],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
    components: {
      edit: {
        beforeDocumentControls: ['/collections/meetings/components/NavCloser'],
      },
    },
  },
  versions: {
    drafts: true,
    maxPerDoc: 5,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'כללי',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'stock',
                  label: 'נייר ערך',
                  type: 'relationship',
                  relationTo: 'stocks',
                  filterOptions: ({ siblingData, req }: any) => {
                    if (req?.context?.from == 'migration' || req?.context?.from == 'process') {
                      return true
                    }
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
                    width: '330px',
                  },
                },
                {
                  name: 'type',
                  label: 'סוג',
                  index: true,
                  type: 'select',
                  interfaceName: 'MeetingType',
                  required: true,
                  options: meetingTypeOptions,
                  admin: {
                    width: '150px',
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
                  name: 'magnaId',
                  label: 'אסמכתא',
                  type: 'text',
                  index: true,
                  admin: {
                    width: '150px',
                  },
                },
                {
                  name: 'invitationLink',
                  label: 'זימון',
                  type: 'text',
                  index: true,
                  admin: {
                    width: '200px',

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
                {
                  name: 'invitationDocument',
                  label: 'מסמך זימון',
                  type: 'upload',
                  relationTo: 'documents',
                  admin: {
                    className: 'invitationDocument',
                    width: '220px',
                  },
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
                        return `${stockName}-${data?.type ? data?.type : 'נדחתה/בוטלה'}`
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
                  name: 'state',
                  label: 'מצב',
                  type: 'select',
                  required: true,
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
                  options: meetingStateOptions,
                  admin: {
                    width: '150px',
                  },
                },
                {
                  name: 'holdingsLimit',
                  label: 'מועד קובע',
                  type: 'date',
                  index: true,
                  admin: {
                    width: '200px',
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
                    width: '220px',

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
                    width: '220px',
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
                  name: 'dualMeeting',
                  type: 'relationship',
                  relationTo: 'meetings',
                  hasMany: false,
                  label: 'אסיפה דואלית',
                  admin: {
                    readOnly: true,
                    width: '50%',
                    condition: (data) => Boolean(data?.dualMeeting),
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
                  admin: {
                    width: '50%',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'comments',
                  label: 'הערות',
                  type: 'textarea',
                  admin: {
                    width: '50%',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'resultsConfirmationStatus',
                  label: 'אימות תוצאות',
                  type: 'checkbox',
                  admin: {
                    width: 'auto',
                    condition: (siblingData) => siblingData.state === 'completed',
                  },
                },
                {
                  name: 'electronicVotingEnabled',
                  label: 'האם מופיעה במערכת האלק׳?',
                  type: 'checkbox',
                  admin: { width: 'auto', disableListFilter: true },
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
                className: 'agenda-style-wrapper',
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
                      name: 'isRemovedFromAgenda',
                      label: 'הוסר מסדר היום',
                      type: 'checkbox',
                      admin: { width: '200px', disableListFilter: true },
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
                  type: 'group',
                  fields: votingRecommendation as Field[],
                },
                {
                  type: 'group',
                  name: 'exceptionalRecommendation',
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'showExceptional',
                          label: 'המלצה חריגה',
                          type: 'checkbox',
                          admin: {
                            width: '155px',
                          },
                        },
                        {
                          name: 'companies',
                          label: 'חברות',
                          type: 'relationship',
                          relationTo: 'companies',
                          hasMany: true,
                          filterOptions: ({ data, req }) => {
                            if (
                              req?.context?.from == 'migration' ||
                              req?.context?.from == 'process' ||
                              data?.companies?.length == 0
                            ) {
                              return true
                            }
                            return {
                              id: {
                                in: data?.companies?.map(getIdOfRelationField) || [],
                              },
                            }
                          },
                          admin: {
                            width: '800px',
                            condition: (_, siblingData) => siblingData?.showExceptional === true,
                          },
                        },
                      ],
                    },
                    ...(votingRecommendationExceptional as Field[]),
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'result',
                      label: 'החלטה',
                      type: 'select',
                      admin: {
                        width: '30%',

                        condition: (value, siblingData) =>
                          siblingData.topicType === 'decision' && value?.state === 'completed',
                      },
                      options: [
                        { label: '---', value: '0' },
                        { label: 'אושר', value: '1' },
                        { label: 'לא אושר', value: '2' },
                        { label: 'דיון', value: '3' },
                      ],
                    },
                    {
                      name: 'vPercentSpecial',
                      label: 'תוצאה באחוזים',
                      type: 'number',
                      admin: {
                        width: '15%',

                        step: 0.01,
                        condition: (_, siblingData) =>
                          siblingData.topicType === 'decision' &&
                          siblingData.majorityType === 'privileged' &&
                          siblingData.result,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'מסמכי מחקר',
          admin: {
            condition: (data) => data?.companies?.length > 0,
          },
          fields: [
            {
              name: 'researchDocuments',
              label: 'מסמך מחקר',
              type: 'upload',
              relationTo: 'research-documents',
              hasMany: true,
              admin: {
                description:
                  'יש להעלות מסמך מחקר שמתחיל בשם נייר הערך ולאחר מכן בסוגריים שם החברה. ניתן להוסיף רק חברות שמוזמנות לאסיפה זו.',
                components: {
                  Field: '/collections/meetings/components/ResearchUploadDisplay',
                },
              },
            },
          ],
        },
        {
          label: 'הצבעות',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'votesCount',
                  label: 'מספר הצבעות',
                  type: 'number',
                  defaultValue: 0,
                  admin: {
                    readOnly: true,
                    width: '150px',
                  },
                },
                {
                  name: 'votesStatus',
                  label: 'סטטוס הצבעות',
                  type: 'select',
                  defaultValue: 'None',
                  interfaceName: 'VotesStatus',
                  options: [
                    { label: 'ללא', value: 'None' },
                    { label: 'חלקי', value: 'Partial' },
                    { label: 'מלא', value: 'All' },
                  ],
                  admin: {
                    readOnly: true,
                    width: '150px',
                  },
                },
                {
                  name: 'reportVotesCount',
                  label: 'מספר הצבעות בפועל',
                  type: 'number',
                  defaultValue: 0,
                  admin: {
                    readOnly: true,
                    width: '150px',
                  },
                },
                {
                  name: 'votesReportStatus',
                  label: 'סטטוס הצבעות בפועל',
                  type: 'select',
                  interfaceName: 'VotesReportStatus',
                  defaultValue: 'None',
                  options: [
                    { label: 'ללא', value: 'None' },
                    { label: 'חלקי', value: 'Partial' },
                    { label: 'מלא', value: 'All' },
                  ],
                  admin: {
                    readOnly: true,
                    width: '150px',
                  },
                },
              ],
            },
            {
              type: 'relationship',
              relationTo: 'companies',
              hasMany: true,
              name: 'companies',
              label: 'חברות',
              index: true,
              maxDepth: 1,
              filterOptions: ({ req }) => {
                if (req?.context?.from == 'migration' || req?.context?.from == 'process')
                  return true

                return {
                  type: {
                    equals: 'regular',
                  },
                }
              },
              admin: {
                hidden: true,
                readOnly: true,
              },
            },
            {
              type: 'relationship',
              relationTo: 'companies',
              hasMany: true,
              name: 'companiesNotYetVoted',
              label: 'חברות שטרם הצביעו',
              virtual: true,
              admin: {
                components: {
                  Field: {
                    path: '/collections/meetings/components/CompaniesRelationshipField',
                  },
                },
              },
              hooks: {
                afterRead: [
                  async ({ data, req }) => {
                    if (!data?.votes?.docs || !data?.companies) {
                      return []
                    }
                    const votes = await req.payload.find({
                      collection: 'votes',
                      select: {
                        company: true,
                      },
                      where: {
                        id: {
                          in: data?.votes?.docs,
                        },
                      },
                      limit: 0,
                      depth: 1,
                    })
                    const votedCompanyIds = votes.docs.map((vote) => vote.company)
                    const nonVotedCompanies = data.companies.filter(
                      (companyId: string) => !votedCompanyIds.includes(companyId),
                    )
                    return nonVotedCompanies
                  },
                ],
              },
            },
            {
              name: 'participationReport',
              label: 'דוח השתתפות',
              type: 'upload',
              relationTo: 'documents',
              admin: {
                hidden: true,
                components: {
                  Cell: { path: '/admincomponents/icon/ParticipationReportStatusCell' },
                },
              },
            },

            {
              name: 'votes',
              label: 'הצבעות',
              type: 'join',
              collection: 'votes',
              on: 'meeting',
              defaultLimit: 0,
              maxDepth: 1,
              admin: {
                allowCreate: false,
                defaultColumns: ['title', 'creator', 'updatedAt', 'reported', 'checksum'],
              },
              where: {
                or: [
                  {
                    _status: {
                      equals: 'published',
                    },
                  },
                  {
                    _status: {
                      equals: 'draft',
                    },
                    publishDate: {
                      not_equals: null,
                    },
                  },
                ],
              },
            },
          ],
        },
        {
          label: 'תיקים',
          fields: [
            {
              type: 'relationship',
              relationTo: 'companies',
              hasMany: true,
              name: 'funds',
              label: 'תיקים',
              index: true,
              maxDepth: 0,
              filterOptions: ({ req }) => {
                if (req?.context?.from == 'migration' || req?.context?.from == 'process')
                  return true
                return {
                  type: {
                    equals: 'fund',
                  },
                }
              },
              admin: {
                readOnly: true,
              },
            },
            {
              name: 'fundsWithHolding',
              label: 'תיקים עם אחזקות',
              admin: {
                readOnly: true,
              },
              labels: { plural: 'תיקים עם אחזקות', singular: 'תיק עם אחזקות' },
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'fund',
                      label: 'מזהה תיק',
                      type: 'text',
                    },
                    {
                      name: 'quantity',
                      label: 'כמות',
                      type: 'number',
                    },
                    {
                      name: 'ownedQuantity',
                      label: 'כמות בבעלות',
                      type: 'number',
                    },
                    {
                      name: 'original',
                      label: 'מניה מקורית חול',
                      type: 'array',
                      admin: {
                        initCollapsed: true,
                        components: {
                          Field: '/admincomponents/fields/arrayTable',
                        },
                        condition: (data, siblingData) => {
                          return (
                            Array.isArray(siblingData.original) && siblingData.original.length > 0
                          )
                        },
                      },
                      fields: [
                        { name: 'stockId', label: 'מניה', type: 'text' },
                        { name: 'accountNum', label: 'מספר חשבון', type: 'number' },
                        { name: 'quantity', label: 'כמות', type: 'number' },
                      ],
                    },
                  ],
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
      ],
    },
  ],

  hooks: {
    afterChange: [
      async ({ req, doc, previousDoc, operation }) => {
        // Handle dual stock creation
        if (operation === 'create' && req.context?.from !== 'process') {
          const stock = await req.payload.findByID({
            collection: 'stocks',
            id: doc.stock,
          })

          if (stock?.isDual && stock?.dualStock) {
            // Create dual meeting by cloning the current meeting
            const dualMeeting = JSON.parse(JSON.stringify(doc))
            delete dualMeeting.id
            delete dualMeeting.meetingId
            delete dualMeeting.dualMeeting
            dualMeeting.stock = stock.dualStock

            try {
              const createdDualMeeting = await req.payload.create({
                collection: 'meetings',
                data: dualMeeting,
                context: { from: 'process' },
              })

              await updateCompaniesMeetingsOnMeetingChange(req, createdDualMeeting)

              // Only update the original meeting with the relation
              await req.payload.update({
                collection: 'meetings',
                id: doc.id,
                data: {
                  dualMeeting: createdDualMeeting.id,
                },
                context: { from: 'process' },
              })
            } catch (error) {
              console.error('Error creating dual meeting:', error)
            }
          }
        }

        const holdingsLimitChanged =
          previousDoc?.holdingsLimit?.toString() !== doc?.holdingsLimit?.toString()
        const stockChanged =
          getIdOfRelationField(previousDoc?.stock) !== getIdOfRelationField(doc?.stock)
        const firstPublish =
          previousDoc?._status === 'draft' &&
          doc._status === 'published' &&
          (!doc.meetings || doc.meetings.length === 0)

        if (holdingsLimitChanged || stockChanged || firstPublish) {
          if (req.context?.from !== 'process' && req.context?.from !== 'migration') {
            await updateCompaniesMeetingsOnMeetingChange(req, doc)
          }
        }
        if (
          req.context?.from !== 'process' &&
          req.context?.from !== 'migration' &&
          operation === 'update'
        ) {
          await syncDualMeeting(req.payload, doc, previousDoc)
        }
      },
      afterChangeDeleteResearchDocs,
    ],
    beforeValidate: [validateResearchDocsInMeetings],
    beforeChange: [
      handleRecommendationReason,
      clearCompaniesInSingleBondResearchDoc,
      beforeChangeMeetingId,
      updateVoteStatusOnCompaniesChange, // Add hook to update vote statuses when companies change
    ],
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
    {
      path: '/by-id',
      method: 'get',
      handler: meetingForVotingEndPoint,
    },
    {
      path: '/voting-report',
      method: 'get',
      handler: meetingForVotingEndPoint,
    },
  ],
}
