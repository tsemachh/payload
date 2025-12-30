import type { Field, Where } from 'payload'
import { type CollectionConfig } from 'payload'
import ProcessMeetingStateEndpoint from './endpoints/ProcessMeetingStateEndpoint'
import ProcessMeetingCompaniesEndPoint from './endpoints/ProcessMeetingCompaniesEndPoint'
import ResearchWarningsEndpoint from './endpoints/ResearchWarningsEndpoint'
import {
  allMeetingsEndpoint,
  futureMeetingsEndpoint,
  meetingForVotingEndPoint,
} from './endpoints/MeetingsEndpoints'
import {
  getVotedCompaniesEndpoint,
  getNotVotedCompaniesEndpoint,
  getHistoricalHoldingsEndpoint,
  getCompaniesOrderEndpoint,
} from './endpoints/VotingDataEndpoints'
import { IconLinkProps } from '@/admincomponents/link/IconLinkProps'
import { updateCompaniesMeetingsOnMeetingChange } from './hooks/updateCompaniesMeetings'
import uploadMeetingsCsvEndPoint from './feeds/uploadMeetingsCsvEndPoint'
import uploadMeetingsAgendaEndPoint from './feeds/uploadMeetingsAgendaEndPoint'
import addCompanyEndpoint from './endpoints/AddCompanyEndpoint'
import ExportMeetingsExcelEndpoint from './endpoints/ExportMeetingsExcelEndpoint'
import removeCompanyEndpoint, {
  restoreCompanyEndpoint,
  removeFundEndpoint,
} from './endpoints/RemoveCompanyEndpoint'
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
  setStockValueOnCreateOrHoldingsChange,
  updateStockRegisteredValue,
  validateMeetingInvitationLink,
  validateMeetingState,
} from '@/collections/meetings/hooks/adminHooks'
import { meetingStateOptions, meetingTypeOptions, stockTypeOptions } from '@/consts/otipns-const'
import { updateVoteStatusOnCompaniesChange } from '@/collections/meetings/hooks/votesCountHooks'
import { isAdmin, isUserCompanyMeeting, isUserCompanyMeetingWrite } from '@/utils/authUtils'
import { stockOriginOptions } from '@/app/(frontend)/meetings/filtersConst'
import { syncLabelsOnStockChange } from './hooks/syncLabelsOnStockChange'
import { updateResearchDocumentsStatus } from './hooks/researchDocumentsStatusHook'

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
      _status: { equals: 'published' },
    },
    filterList: [
      [
        { name: 'meetingDate' },
        { name: 'holdingsLimit' },
        { name: 'proxyVotingDate' },
        { name: 'state', width: '200px' },
        { name: 'type', width: '200px' },
        { name: '_status', width: '130px' },
        { name: 'finalized', width: '130px' },
      ],
      [
        { name: 'electronicVotingEnabled', width: '130px' },
        { name: 'hasVoteRecommendation', width: '130px' },
        { name: 'hasResearchDoc', width: '130px' },
        { name: 'votesStatus', width: '130px' },
        { name: 'votesReportStatus', width: '130px' },
        { name: 'researchDocumentsStatus', width: '130px' },
        { name: 'resultsConfirmationStatus', width: '130px' },
        { name: 'hasRelatedStocks', width: '130px' },
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
    listSearchableFields: ['fullName', 'magnaId', 'invitationLink', 'primaryLegacyId', 'legacyIds'],
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
      'hasRelatedStocks',
    ],
    pagination: {
      defaultLimit: 300,
      limits: [100, 200, 300, 500],
    },
    components: {
      listMenuItems: [
        '/collections/meetings/components/ExportMeetingsMenuItem',
        '/collections/meetings/components/ProcessCompaniesMeetingsMenuItem',
        '/collections/meetings/components/MigrateVoteCountsMenuItem',
      ],
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
  indexes: [
    {
      fields: ['_status', 'meetingDate'],
    },
  ],
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'הצבעות',
          admin: {
            condition: (data) => data.publishDate != null,
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
              name: 'removedCompanies',
              label: 'חברות שהוסרו',
              index: true,
              maxDepth: 1,
              admin: {
                hidden: true,
                readOnly: true,
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
                disableListFilter: true,
                components: {
                  Field: '/collections/meetings/components/VotingTablesField',
                },
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
                    const baseFilter: Record<string, any> = {
                      or: [{ isDual: { exists: false } }, { isDual: { equals: false } }],
                    }

                    if (id && data?.stock) {
                      baseFilter.or.push({ id: { equals: data.stock } })
                    }

                    const tradableFilter = { tradable: { equals: true } }

                    if (req?.context?.from == 'migration' || req?.context?.from == 'process') {
                      return tradableFilter
                    }

                    if (!siblingData?.meetingDate) {
                      return {
                        and: [{ active: { equals: true } }, baseFilter, tradableFilter],
                      }
                    }

                    const meetingDate = new Date(siblingData.meetingDate)
                    const currentDate = new Date()
                    const isFutureDate = meetingDate > currentDate

                    if (isFutureDate) {
                      return {
                        and: [{ active: { equals: true } }, baseFilter, tradableFilter],
                      }
                    }

                    return {
                      and: [baseFilter, tradableFilter],
                    }
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
                  name: 'stockName',
                  label: 'שם נייר',
                  type: 'text',
                  virtual: 'stock.name',
                  admin: {
                    hidden: true,
                  },
                },
                {
                  name: 'legacyStockNum',
                  label: 'Legacy Stock Num',
                  type: 'text',
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
                  hooks: {
                    beforeChange: [
                      async ({ value, data, req, operation }) => {
                        // Only auto-fill relatedQuestions if it's empty/null and we have a meeting type
                        if (!value || !data || data.relatedQuestions) {
                          return value
                        }

                        // Find questions that are marked for auto-fill for this meeting type
                        const matchingQuestions = await req.payload.find({
                          collection: 'questions',
                          where: {
                            and: [
                              { type: { equals: value } },
                              { autoFillInMeetings: { equals: true } },
                            ],
                          },
                          limit: 1,
                          depth: 0,
                        })

                        // Auto-populate relatedQuestions if we found matching questions
                        if (matchingQuestions.docs.length > 0) {
                          data.relatedQuestions = matchingQuestions.docs[0].id
                        }

                        return value
                      },
                    ],
                  },
                },
                {
                  name: 'primaryLegacyId',
                  label: 'מזהה לגאסי (ראשי)',
                  type: 'text',
                  index: true,
                  admin: { width: '140px', hidden: true },
                },
                {
                  name: 'legacyIds',
                  label: 'מזהים בלגאסי (כללי)',
                  type: 'text',
                  hasMany: true,
                  index: true,
                  admin: { width: '330px', hidden: true },
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
                {
                  name: 'finalized',
                  label: 'סופית',
                  type: 'checkbox',
                  index: true,
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
                  name: 'stockValue',
                  type: 'relationship',
                  relationTo: 'stock-values',
                  label: 'ערך נייר מתאריך',
                  hasMany: false,
                  required: false,
                  admin: {
                    width: '300px',
                    disableListColumn: true,
                  },
                  filterOptions: ({ data, req }) => {
                    const where: Where = {
                      or: [
                        {
                          stockId: {
                            equals: data?.stock,
                          },
                        },
                        {
                          'stockId.dualStock': {
                            equals: data?.stock,
                          },
                        },
                      ],
                    }
                    if (data?.holdingsLimit) {
                      where.valueDate = {
                        less_than_equal: new Date(data?.holdingsLimit).toISOString(),
                      }
                    }
                    return where
                  },
                  maxDepth: 1,
                },
                {
                  name: 'stockClosingRate',
                  virtual: 'stockValue.closingRate',
                  label: 'שער סגירה',
                  type: 'number',
                  admin: {
                    width: '200px',
                    readOnly: true,
                    components: {
                      Cell: {
                        path: '/admincomponents/cell/FormattedNumber',
                        clientProps: { decimals: 1 },
                      },
                    },
                  },
                },
                {
                  name: 'stockRegisteredValue',
                  label: 'הון רשום',
                  type: 'number',
                  admin: {
                    width: '200px',
                    readOnly: true,
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
                    width: '200px',
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
              name: 'relatedQuestions',
              label: 'שאלות קשורות',
              type: 'relationship',
              relationTo: 'questions',
              hasMany: false,
              admin: {
                description:
                  'שאלות שימולאו אוטומטית בטופס ההצבעה. ברירת המחדל היא שאלות התואמות לסוג האסיפה, אך ניתן לשנות ידנית.',
              },
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
              maxDepth: 0,
              admin: {
                description:
                  'יש להעלות מסמך מחקר שמתחיל בשם נייר הערך ולאחר מכן בסוגריים שם החברה. ניתן להוסיף רק חברות שמוזמנות לאסיפה זו.',
                components: {
                  Field: '/collections/meetings/components/ResearchUploadDisplay',
                },
              },
              hooks: {
                beforeChange: [updateResearchDocumentsStatus],
              },
            },
            {
              name: 'researchDocumentsStatus',
              label: 'סטטוס מסמכי מחקר',
              type: 'select',
              options: [
                { label: 'ריק', value: 'empty' },
                { label: 'חלקי', value: 'partial' },
                { label: 'מלא', value: 'complete' },
              ],
              admin: {
                description: 'מציין את סטטוס מסמכי המחקר עבור חברות האסיפה',
                readOnly: true,
                hidden: true,
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
                      name: 'holdingDate',
                      type: 'date',
                      label: 'תאריך החזקה',
                      admin: {
                        readOnly: true,
                        date: {
                          displayFormat: 'dd/MM/yyyy',
                          pickerAppearance: 'default',
                        },
                      },
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
              name: 'historicalHoldings',
              label: 'החזקות היסטוריות (30 יום לפני)',
              admin: {
                readOnly: true,
                description: 'חברות שהחזיקו 30 יום לפני מועד הרישום אך לא הוזמנו לאסיפה',
              },
              labels: {
                plural: 'החזקות היסטוריות',
                singular: 'החזקה היסטורית',
              },
              type: 'array',
              interfaceName: 'HistoricalHolding',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'company',
                      label: 'מזהה חברה',
                      type: 'text',
                      index: true,
                      required: true,
                    },
                    {
                      name: 'fund',
                      label: 'מזהה תיק',
                      type: 'text',
                    },
                    {
                      name: 'lastHoldingDate',
                      label: 'תאריך החזקה אחרון',
                      type: 'date',
                      required: true,
                      admin: {
                        date: {
                          pickerAppearance: 'dayOnly',
                        },
                      },
                    },
                    {
                      name: 'quantity',
                      label: 'כמות',
                      type: 'number',
                      required: true,
                    },
                  ],
                },
              ],
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

        // Create notifications for significant changes (when changeDetails is added)
        if (
          operation === 'update' &&
          doc.changeDetails &&
          doc.changeDetails !== previousDoc?.changeDetails &&
          req.context?.from !== 'process' &&
          req.context?.from !== 'migration'
        ) {
          const companies = (doc.companies || []) as string[]
          if (companies.length === 0) return

          const today = new Date()
          const formattedDate = today.toLocaleDateString('he-IL')

          const meetingName = doc.fullName || 'אסיפה'
          const url = `${req.payload.config.serverURL}//vote-meeting/${doc.id}`
          const message = `אסיפה ${meetingName} עודכנה בתאריך (${formattedDate}), לשינויים \n  הערות:  ${doc.changeDetails}.`

          for (const companyId of companies) {
            try {
              // Delete existing notifications to avoid duplicates
              await req.payload.delete({
                collection: 'company-meeting-notifications',
                where: {
                  company: { equals: companyId },
                  meeting: { equals: doc.id },
                  notificationType: { equals: 'meeting-updated' },
                  message: { equals: message },
                  url: { equals: url },
                },
              })

              // Create new notification
              await req.payload.create({
                collection: 'company-meeting-notifications',
                data: {
                  message,
                  notificationType: 'meeting-updated',
                  meeting: doc.id,
                  company: companyId,
                  readStatus: false,
                  url: url,
                },
              })
            } catch (error) {
              console.error(
                `Error creating notification for company ${companyId} (meeting ${doc.id}):`,
                error,
              )
            }
          }
        }

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
            delete dualMeeting.primaryLegacyId
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
                  migrationComments: `${changeDate} - [${changeSource}] Created dual meeting for stock ${stock.fullName || stock.id}`,
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
          previousDoc?._status === 'draft' &&
          doc?._status === 'published' &&
          (!previousDoc.companies || previousDoc.companies.length === 0)
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
      setStockValueOnCreateOrHoldingsChange, // Auto-pick stockValue on create / holdingsLimit change
      updateStockRegisteredValue, // Update stockRegisteredValue when stockValue changes
      syncLabelsOnStockChange,
      handleResult, // Automatically update state to 'ended' when all results are filled
    ],
  },
  endpoints: [
    {
      path: '/export-excel',
      method: 'get',
      handler: ExportMeetingsExcelEndpoint,
    },
    {
      path: '/recalculate-vote-counts',
      method: 'post',
      handler: async (req) =>
        (await import('./endpoints/RecalculateVoteCountsEndpoint')).default(req),
    },
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
      path: '/:id/research-warnings',
      method: 'post',
      handler: ResearchWarningsEndpoint,
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
    {
      path: '/add-company',
      method: 'post',
      handler: addCompanyEndpoint,
    },
    {
      path: '/remove-company',
      method: 'post',
      handler: removeCompanyEndpoint,
    },
    {
      path: '/restore-company',
      method: 'post',
      handler: restoreCompanyEndpoint,
    },
    {
      path: '/removeFund',
      method: 'post',
      handler: removeFundEndpoint,
    },
    {
      path: '/voting-data/voted-companies',
      method: 'get',
      handler: getVotedCompaniesEndpoint,
    },
    {
      path: '/voting-data/not-voted-companies',
      method: 'get',
      handler: getNotVotedCompaniesEndpoint,
    },
    {
      path: '/voting-data/companies-order',
      method: 'get',
      handler: getCompaniesOrderEndpoint,
    },
    {
      path: '/voting-data/historical-holdings',
      method: 'get',
      handler: getHistoricalHoldingsEndpoint,
    },
  ],
}
