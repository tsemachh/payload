import type { CollectionBeforeChangeHook, Field, TextFieldSingleValidation } from 'payload'
import { type CollectionConfig, SelectFieldSingleValidation } from 'payload'
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
import { v1 as uuid1 } from 'uuid'

const PropsManualLink: IconLinkProps = {
  urlTemplate: '${value}',
  iconUrl: '/link.ico', // You'll need to create this icon
  iconAltText: 'קישור ידני',
  iconOnly: true,
}
const beforeChangeMeetingId: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation == 'create') {
    if (!data.meetingId) {
      data.meetingId = uuid1()
    }
  }
  return data
}
const validateMeetingInvitationLink: TextFieldSingleValidation = (
  value: string | null | undefined,
  options: any,
) => {
  if (options.req.context.from == 'migration' || options.req.context.from == 'process') {
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

  if (options.req.context.from == 'migration' || options.req.context.from == 'process') {
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
          disableListFilter: true,
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
          disableListFilter: true,
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
        { name: 'holdingsLimit' },
        { name: 'meetingDate' },
        { name: 'proxyVotingDate' },
        { name: 'state' },
        { name: 'type' },
      ],
      [
        { name: 'resultsConfirmationStatus' },
        { name: 'electronicVotingEnabled' },
        { name: 'committeeInitiated' },
        { name: '_status' },
      ],
    ],
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'fullName',
    group: 'פעילות',

    listSearchableFields: ['fullName', 'magnaId', 'invitationLink', 'meetingId'],
    defaultColumns: [
      'fullName',
      'invitationLink',
      'holdingsLimit',
      'meetingDate',
      'state',
      'comments',
      'votesCount',
      'reportedVotesCount',
    ],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
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
                    disableListFilter: true,
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
                    disableListFilter: true,
                  },
                },
                {
                  name: 'invitationLink',
                  label: 'זימון',
                  type: 'text',
                  index: true,
                  admin: {
                    width: '200px',
                    disableListFilter: true,
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
                    disableListFilter: true,
                  },
                },
                {
                  name: 'fullName',
                  label: 'שם',
                  type: 'text', // Stored in the database
                  admin: {
                    hidden: true, // Hide in admin UI to prevent manual edits
                    disableListFilter: true,
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
                        return `${stockName}-${data?.type}`
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
                    disableListFilter: true,
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
                  name: 'location',
                  label: 'כתובת',
                  type: 'text',
                  admin: {
                    width: '50%',
                    disableListFilter: true,
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
                    disableListFilter: true,
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
                    disableListFilter: true,
                  },
                },
                {
                  name: 'electronicVotingEnabled',
                  label: 'האם מופיעה במערכת האלק׳?',
                  type: 'checkbox',
                  admin: { width: 'auto', disableListFilter: true },
                },
                {
                  name: 'committeeInitiated',
                  label: 'האם פיננסי דורש ועדה?',
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
                disableListFilter: true,
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
                    disableListFilter: true,
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
                        disableListFilter: true,
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
                        disableListFilter: true,
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
                    ...(votingRecommendationExceptional as Field[]),
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'showExceptional',
                          label: 'המלצה חריגה',
                          type: 'checkbox',
                          admin: {
                            width: '20%',
                            disableListFilter: true,
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
                            disableListFilter: true,
                            width: '80%',
                            condition: (_, siblingData) => siblingData?.showExceptional === true,
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  name: 'vPercentSpecial',
                  label: 'אחוז הצבעה מיוחד',
                  type: 'number',
                  admin: {
                    disableListFilter: true,
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
                    disableListFilter: true,
                    condition: (value, siblingData) => {
                      return siblingData.topicType === 'decision' && value?.state === 'completed'
                    },
                  },
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
                disableListFilter: true,
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
              name: 'votesCount',
              label: 'הצבעות',
              type: 'text',
              admin: {
                disableListFilter: true,
                readOnly: true,
                width: '600px',
                components: {
                  Cell: {
                    path: '/admincomponents/icon/VotingCountsStatusCell',
                  },
                  Field: {
                    path: '/admincomponents/icon/VotingCountsStatusTextField',
                  },
                },
              },
              hooks: {
                afterRead: [
                  ({ data }) => {
                    return `${data?.votes?.docs?.length || 0}/${data?.companies?.length || 0}`
                  },
                ],
              },
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
              name: 'reportedVotesCount',
              label: 'דיווחים',
              type: 'text',
              admin: {
                hidden: true,
                components: {
                  Cell: { path: '/admincomponents/icon/ReportedVotesStatusCell' },
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
              maxDepth: 0,
              admin: {
                allowCreate: false,
                disableListFilter: true,
                defaultColumns: ['title', 'creator', 'updatedAt', 'reported'],
              },
              where: {
                _status: { equals: 'published' },
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
                disableListFilter: true,
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
                disableListFilter: true,
              },
              maxDepth: 1,
            },
          ],
        },
      ],
    },
  ],

  hooks: {
    afterRead: [
      async ({ doc, req }) => {
        if (!doc) {
          return { reportedVotesCount: '0/0' }
        }
        if (doc?.votes?.docs?.length) {
          const voteIds = doc.votes.docs

          try {
            const votesResponse = await req.payload.find({
              collection: 'votes',
              where: {
                and: [{ id: { in: voteIds } }, { _status: { equals: 'published' } }],
              },
              select: {
                id: true,
                reported: true,
              },
              depth: 0,
              limit: 0,
            })
            const totalVotes = votesResponse.docs.length

            const reportedVotes = votesResponse.docs.filter((vote) => vote.reported === true).length

            doc.reportedVotesCount = `${reportedVotes}/${totalVotes}`
          } catch (error) {
            console.error('Error fetching votes for reportedVotesCount:', error)
            doc.reportedVotesCount = '0/0'
          }
        } else {
          doc.reportedVotesCount = '0/0'
        }
        return doc
      },
    ],
    afterChange: [
      async ({ req, doc, previousDoc }) => {
        const holdingsLimitChanged =
          previousDoc?.holdingsLimit?.toString() !== doc?.holdingsLimit?.toString()
        const stockChanged = previousDoc?.stock !== doc?.stock
        const firstPublish =
          previousDoc._status == 'draft' &&
          doc._status == 'published' &&
          (!doc.meetings || doc.meetings.length == 0)
        if (holdingsLimitChanged || stockChanged || firstPublish) {
          if (req.context?.from !== 'process' && req.context?.from !== 'migration') {
            await updateCompaniesMeetingsOnMeetingChange(req, doc)
          }
        }
      },
      afterChangeDeleteResearchDocs,
    ],

    beforeValidate: [validateResearchDocsInMeetings],
    beforeChange: [
      handleRecommendationReason,
      clearCompaniesInSingleBondResearchDoc,
      beforeChangeMeetingId,
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
