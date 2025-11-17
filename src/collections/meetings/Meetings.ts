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
import { calculatPercentageHolding } from '@/utils/dataUtils'
import { syncDualMeeting } from './hooks/syncDualMeeting'
import {
  beforeChangeMeetingId,
  handleResult,
  updateStockRegisteredValue,
  validateMeetingInvitationLink,
  validateMeetingState,
} from '@/collections/meetings/hooks/adminHooks'
import { meetingStateOptions, meetingTypeOptions, stockTypeOptions } from '@/consts/otipns-const'
import { updateVoteStatusOnCompaniesChange } from '@/collections/meetings/hooks/votesCountHooks'
import { isAdmin, isUserCompanyMeeting, isUserCompanyMeetingWrite } from '@/utils/authUtils'
import { stockOriginOptions } from '@/app/(frontend)/meetings/filtersConst'
import { syncLabelsOnStockChange } from './hooks/syncLabelsOnStockChange'

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
    defaultFilter: {
      meetingDate: 'todayAndFuture',
    },
    filterList: [
      [
        { name: 'meetingDate' },
        { name: 'holdingsLimit' },
        { name: 'proxyVotingDate' },
        { name: 'state', width: '200px' },
        { name: 'type', width: '200px' },
        { name: '_status', width: '130px' },
      ],
      [
        { name: 'electronicVotingEnabled', width: '130px' },
        { name: 'hasVoteRecommendation', width: '130px' },
        { name: 'hasResearchDoc', width: '130px' },
        { name: 'votesStatus', width: '130px' },
        { name: 'votesReportStatus', width: '130px' },
        { name: 'resultsConfirmationStatus', width: '130px' },
      ],
      [
        { name: 'stock.type', width: '130px' },
        { name: 'stock.origin', width: '130px' },
        { name: 'stock.isFinancial', width: '130px' },
        { name: 'stock.hasDual', width: '130px' },
        { name: 'stock.isDual', width: '130px' },
      ],
    ],
  },
  access: {
    create: isAdmin,
    read: isUserCompanyMeeting,
    update: isUserCompanyMeetingWrite,
    delete: isAdmin,
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
      'activity',
      'totalHoldings',
      'electronicVotingEnabled',
      'invitationLink',
    ],
    pagination: {
      defaultLimit: 300,
      limits: [100, 200, 300, 500],
    },
    components: {
      edit: {
        beforeDocumentControls: ['/collections/meetings/components/NavCloser'],
        PublishButton: '/components/buttons/CustomPublishButton',
      },
    },
  },
  versions: {
    drafts: true,
    maxPerDoc: 20,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'הצבעות',
          admin: {
            condition: (data) => data?._status === 'published',
          },
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
                    hidden: true,
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
                    { label: 'ריק', value: 'None' },
                    { label: 'חלקי', value: 'Partial' },
                    { label: 'מלא', value: 'All' },
                  ],
                  admin: {
                    readOnly: true,
                    hidden: true,
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
                    hidden: true,
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
                    { label: 'ריק', value: 'None' },
                    { label: 'חלקי', value: 'Partial' },
                    { label: 'מלא', value: 'All' },
                  ],
                  admin: {
                    readOnly: true,
                    hidden: true,
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
                hidden: true,
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
                      depth: 0,
                    })
                    const votedCompanyIds = votes.docs.map((vote) => vote.company)
                    return data.companies.filter(
                      (companyId: string) => !votedCompanyIds.includes(companyId),
                    )
                  },
                ],
              },
            },
            {
              name: 'totalHoldings',
              label: 'החזקות(%)',
              type: 'number',
              virtual: true,
              admin: {
                hidden: true,
                components: {
                  Cell: {
                    path: '/admincomponents/cell/FormattedNumber',
                    clientProps: { decimals: 0, suffix: '%' },
                  },
                },
              },
              hooks: {
                afterRead: [
                  async ({ data, req }) => {
                    if (
                      !data?.fundsWithHolding ||
                      !Array.isArray(data.fundsWithHolding) ||
                      data.fundsWithHolding.length === 0
                    ) {
                      return 0
                    }

                    // Sum up all quantities first, then calculate percentage on the total
                    const totalQuantity = data.fundsWithHolding.reduce(
                      (sum: number, holding: any) => {
                        return sum + (holding.ownedQuantity || holding.quantity || 0)
                      },
                      0,
                    )

                    // Calculate holding values using the imported function on the total sum
                    const percentageHolding = calculatPercentageHolding(
                      totalQuantity,
                      data.stockRegisteredValue,
                    )

                    return percentageHolding // Already rounded to 4 decimal places by calculateHoldingValues
                  },
                ],
              },
            },
            {
              name: 'activity',
              label: 'פעילות',
              type: 'text',
              virtual: true,
              admin: {
                components: {
                  Cell: { path: '/admincomponents/icon/CompactMeetingBarCell' },
                  Field: '/collections/meetings/components/ActivityStatsField',
                },
              },
              hooks: {
                afterRead: [
                  async ({ data }) => {
                    // Return the data needed for the component as a JSON string
                    return JSON.stringify({
                      companies: data?.companies?.length || 0,
                      votes: data?.votesCount || 0,
                      reportedVotes: data?.reportVotesCount || 0,
                    })
                  },
                ],
              },
            },
            {
              name: 'hasResearchDoc',
              label: 'יש מסמך מחקר',
              type: 'checkbox',
              admin: {
                hidden: true,
              },
              hooks: {
                afterRead: [
                  async ({ data }) => {
                    return data?.researchDocuments?.length > 0
                  },
                ],
              },
            },
            {
              name: 'hasVoteRecommendation',
              label: 'יש המלצת הצבעה',
              type: 'checkbox',
              admin: {
                hidden: true,
              },
              hooks: {
                afterRead: [
                  async ({ data }) => {
                    if (!data?.agenda || !Array.isArray(data.agenda) || data.agenda.length === 0) {
                      return false
                    }
                    return data.agenda.some((item) => {
                      // Check regular recommendation
                      return item?.recommendation?.votingRecommendation
                    })
                  },
                ],
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
                disableListColumn: true,
                components: {
                  Field: '/collections/meetings/components/VotingTablesField',
                },
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
                  filterOptions: ({ siblingData, req, data, id }: any) => {
                    if (req?.context?.from == 'migration' || req?.context?.from == 'process') {
                      return true
                    }

                    const baseFilter: Record<string, any> = {
                      or: [{ isDual: { exists: false } }, { isDual: { equals: false } }],
                    }

                    if (id && data?.stock) {
                      baseFilter.or.push({ id: { equals: data.stock } })
                    }

                    if (!siblingData?.meetingDate) {
                      return {
                        and: [{ active: { equals: true } }, baseFilter],
                      }
                    }

                    const meetingDate = new Date(siblingData.meetingDate)
                    const currentDate = new Date()
                    const isFutureDate = meetingDate > currentDate

                    if (isFutureDate) {
                      return {
                        and: [{ active: { equals: true } }, baseFilter],
                      }
                    }

                    return baseFilter
                  },
                  index: true,
                  required: true,
                  admin: {
                    width: '330px',
                  },
                },
                {
                  name: 'stockId',
                  label: 'מספר נייר',
                  type: 'text',
                  virtual: 'stock.stockId',
                  admin: {
                    hidden: true,
                  },
                },
                {
                  name: 'isFinancialStock',
                  label: 'תאגיד פיננסי',
                  type: 'checkbox',
                  virtual: 'stock.isFinancial',
                  admin: {
                    hidden: true,
                  },
                },
                {
                  name: 'stockOrigin',
                  label: 'מקור הנייר',
                  type: 'select',
                  virtual: 'stock.origin',
                  options: stockOriginOptions,
                  admin: {
                    hidden: true,
                  },
                },
                {
                  name: 'stockType',
                  label: 'סוג הנייר',
                  type: 'select',
                  virtual: 'stock.type',
                  options: stockTypeOptions,
                  admin: {
                    hidden: true,
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
                    custom: {
                      cellWidth: '50px',
                    },
                    width: '150px',
                  },
                },
                {
                  name: 'meetingId',
                  label: 'מספר אסיפה',
                  type: 'text',
                  index: true,
                  admin: { width: '100px', hidden: true },
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
                        path: '/admincomponents/link/TableLinkCell',
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
                    width: '270px',
                  },
                  index: true,
                  hooks: {
                    beforeChange: [
                      async ({ data, req }) => {
                        if (data?.state == 'scheduled' || !data?.fullName) {
                          let stockName = ''
                          if (typeof data?.stock == 'string') {
                            const stock = await getCollectionDoc(req, 'stocks', data.stock, 0)
                            stockName = stock.fullName
                          }
                          return `${stockName}-${data?.type ? data.type : 'נדחתה/בוטלה'}`
                        }
                        return data.fullName
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
                  interfaceName: 'MeetingState',
                  validate: validateMeetingState,
                  options: meetingStateOptions,
                  defaultValue: meetingStateOptions.find((opt) => opt.value === 'scheduled')?.value,
                  admin: {
                    width: '150px',
                  },
                },
                {
                  name: 'holdingsLimit',
                  label: 'מועד קובע',
                  type: 'date',
                  index: true,
                  required: true,
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
                  label: 'מסירת הצבעה',
                  type: 'date',
                  index: true,
                  admin: {
                    width: '220px',
                    date: {
                      timeFormat: 'HH:mm',
                      displayFormat: 'HH:mm dd/MM/yyyy',
                      pickerAppearance: 'dayAndTime',
                      timeIntervals: 15,
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
                  required: true,
                  admin: {
                    width: '220px',
                    date: {
                      displayFormat: 'HH:mm dd/MM/yyyy',
                      timeFormat: 'HH:mm',
                      pickerAppearance: 'dayAndTime',
                      timeIntervals: 15,
                    },
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'isDualStock',
                  label: 'אסיפה דואלית',
                  type: 'checkbox',
                  virtual: 'stock.isDual',
                  admin: {
                    width: '200px',
                    readOnly: true,
                    condition: (data) => Boolean(data?.id),
                  },
                },
                {
                  name: 'mainMeetingForDualMeeting',
                  type: 'relationship',
                  relationTo: 'meetings',
                  hasMany: false,
                  label: 'קישור לאסיפה המכילה',
                  admin: {
                    readOnly: true,
                    width: '400px',
                    condition: (data) => Boolean(data?.id) && Boolean(data?.isDualStock),
                  },
                },
                {
                  name: 'hasDualStock',
                  label: 'מכילה אסיפה דואלית',
                  type: 'checkbox',
                  virtual: 'stock.hasDual',
                  admin: {
                    width: '200px',
                    readOnly: true,
                    condition: (data) => Boolean(data?.id),
                  },
                },
                {
                  name: 'dualMeeting',
                  type: 'relationship',
                  relationTo: 'meetings',
                  hasMany: false,
                  label: 'קישור לאסיפה  הדואלית',
                  admin: {
                    readOnly: true,
                    width: '400px',
                    condition: (data) => Boolean(data?.id) && Boolean(data?.hasDualStock),
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
              name: 'hasRelatedStocks',
              type: 'checkbox',
              defaultValue: false,
              label: 'ניירות עוקבים',
              admin: {
                hidden: true,
              },
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
                {
                  name: 'migrationComments',
                  label: 'הערות מיגרציה',
                  type: 'textarea',
                  admin: {
                    width: '50%',
                    readOnly: true,
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'changeDetails',
                  label: 'פירוט השינויים',
                  type: 'textarea',
                  admin: {
                    width: '50%',
                    hidden: true,
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
                  label: 'מע׳ אלק׳?',
                  type: 'checkbox',
                  admin: { width: 'auto', disableListFilter: true },
                },
              ],
            },
            {
              name: 'labels',
              type: 'array',
              admin: {
                hidden: true,
              },
              fields: [
                {
                  name: 'label',
                  label: 'שם התגית',
                  type: 'text',
                },
                {
                  name: 'color',
                  label: 'צבע התגית',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          label: 'סדר יום',
          fields: [
            {
              name: 'finalized',
              label: 'הסתיימה',
              type: 'checkbox',
              admin: { disableListColumn: true, hidden: true },
            },
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
                initCollapsed: false,
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
                      defaultValue: 'decision',
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
                      defaultValue: 'regular',
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
                      name: 'percentResult',
                      label: 'תוצאה באחוזים',
                      type: 'number',
                      admin: {
                        width: '15%',

                        step: 0.01,
                        condition: (_, siblingData) =>
                          siblingData.topicType === 'decision' && siblingData.result,
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
              label: 'תיקים עם החזקות',
              admin: {
                readOnly: true,
              },
              labels: { plural: 'תיקים עם החזקות', singular: 'תיק עם החזקות' },
              type: 'array',
              interfaceName: 'FundWithHolding',
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
                      name: 'company',
                      label: 'מזהה חברה',
                      type: 'text',
                      index: true,
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
                      name: 'verifiedHoldings',
                      type: 'checkbox',
                      label: 'אימות החזקות',
                    },
                    {
                      name: 'fromRelatedStock',
                      type: 'checkbox',
                      defaultValue: false,
                      label: 'החזקה בנייר עוקב',
                    },
                    {
                      name: 'original',
                      label: 'מניה מקורית',
                      type: 'array',
                      admin: {
                        initCollapsed: true,
                        components: {
                          Field: '/admincomponents/fields/arrayTable',
                        },
                        condition: (_, siblingData) => {
                          return (
                            Array.isArray(siblingData.original) && siblingData.original.length > 0
                          )
                        },
                      },
                      fields: [
                        { name: 'stockId', label: 'מניה', type: 'text' },
                        { name: 'accountNum', label: 'מספר חשבון', type: 'number' },
                        { name: 'quantity', label: 'כמות', type: 'number' },
                        {
                          name: 'verifiedHoldings',
                          type: 'checkbox',
                          label: 'אימות החזקות',
                        },
                        {
                          name: 'ownedQuantity',
                          label: 'כמות בבעלות',
                          type: 'number',
                        },
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
                hidden: false,
                disableListColumn: true,
              },
              maxDepth: 1,
            },
            {
              name: 'stockRegisteredValue',
              type: 'number',
              admin: {
                hidden: false,
                disableListColumn: true,
              },
            },
            {
              name: 'stockMarketValue',
              virtual: 'stockValue.marketValue',
              label: 'שווי שוק',
              type: 'number',
              admin: {
                readOnly: true,
                components: {
                  Cell: {
                    path: '/admincomponents/cell/FormattedNumber',
                    clientProps: { decimals: 0 },
                  },
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
      async ({ req, doc, previousDoc, operation }) => {
        // Track changes for changeDetails field
        const changeDate = new Date().toISOString()
        const changeSource = req.context?.from || 'user'
        let meetingAlreadyProcessed = false

        // Handle dual stock creation
        if (
          operation === 'create' &&
          !['process', 'migration'].includes(req.context?.from as string)
        ) {
          const stock = await req.payload.findByID({
            collection: 'stocks',
            id: doc.stock,
            depth: 0,
          })

          if (stock?.hasDual && stock?.dualStock) {
            // Create dual meeting by cloning the current meeting
            const dualMeeting = JSON.parse(JSON.stringify(doc))
            delete dualMeeting.id
            delete dualMeeting.meetingId
            delete dualMeeting.dualMeeting
            dualMeeting.stock = stock.dualStock
            dualMeeting._status = 'published'
            dualMeeting.mainMeetingForDualMeeting = doc.id

            try {
              const createdDualMeeting = await req.payload.create({
                collection: 'meetings',
                data: dualMeeting,
                context: { from: 'process' },
                req,
              })

              // Process both the dual meeting and the original meeting
              await updateCompaniesMeetingsOnMeetingChange(req, createdDualMeeting)
              await updateCompaniesMeetingsOnMeetingChange(req, doc)
              meetingAlreadyProcessed = true

              // Only update the original meeting with the relation
              await req.payload.update({
                collection: 'meetings',
                id: doc.id,
                data: {
                  dualMeeting: createdDualMeeting.id,
                  changeDetails: `${changeDate} - [${changeSource}] Created dual meeting for stock ${stock.fullName || stock.id}`,
                },
                context: { from: 'process' },
                req,
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
          previousDoc?._status === 'draft' && doc._ && (!doc.meetings || doc.meetings.length === 0)
        const isPublish = doc?._status === 'published'

        if (
          isPublish &&
          (holdingsLimitChanged || stockChanged || firstPublish) &&
          !meetingAlreadyProcessed
        ) {
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
      updateStockRegisteredValue, // Update stockRegisteredValue when stockValue changes
      syncLabelsOnStockChange,
      handleResult, // Automatically update state to 'ended' when all results are filled
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
