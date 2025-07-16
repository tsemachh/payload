import { ValidationError, type CollectionConfig } from 'payload'
import { addDays, isSameDay } from '@/utils/dateUtils'
import { createAdminNotification, getIdOfRelationField } from '@/utils/utils'

import { Meeting } from '@/payload-types'

import {
  getVoteByMeetingAndCompanies,
  getVotedCompanies,
  publishVotes,
  upsertVote,
} from './voteEndPoint'
import { getVotingPercentages } from './votingPercentagesEndPoint'

export const Votes: CollectionConfig = {
  slug: 'votes',
  labels: {
    plural: 'הצבעות',
    singular: 'הצבעה',
  },
  enableQueryPresets: true,
  custom: {
    filterList: [
      [{ name: 'meeting' }, { name: 'company' }, { name: 'reported' }],
      [{ name: 'isInterested' }, { name: 'isSeniorOfficial' }, { name: 'isInstitutionalInvestor' }],
    ],
  },
  versions: {
    drafts: true,
    maxPerDoc: 1,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['meeting', 'companies'],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200],
    },
    components: {
      edit: {
        beforeDocumentControls: ['/collections/votes/components/VoteSubTitle'],
      },
    },
    group: 'פעילות',
  },
  disableBulkEdit: true,
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
                  name: 'meeting',
                  label: 'אסיפה',
                  type: 'relationship',
                  relationTo: 'meetings',
                  maxDepth: 0,
                  required: true,
                  index: true,
                },
                {
                  name: 'company',
                  label: 'חברה',
                  type: 'relationship',
                  relationTo: 'companies',
                  maxDepth: 0,
                  required: true,
                  index: true,
                  filterOptions: ({ req }: any) => {
                    if (req.context?.from == 'migration' || req.context?.from == 'process') {
                      return true
                    }
                    return {
                      type: { equals: 'regular' },
                    }
                  },
                },
                {
                  name: 'title',
                  label: 'כותרת',
                  type: 'text',
                  admin: {
                    hidden: true,
                  },
                  hooks: {
                    afterRead: [
                      async ({ data, req }) => {
                        if (data?.company && typeof data.company === 'string') {
                          const company = await req.payload.findByID({
                            collection: 'companies',
                            select: {
                              name: true,
                            },
                            id: data.company,
                            depth: 0,
                          })
                          return `הצבעה ${company?.name || 'ללא שם חברה'}`
                        }
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
                  name: 'isInterested',
                  label: 'בעל עניין',
                  type: 'checkbox',
                  defaultValue: false,
                },
                {
                  name: 'interestedExplanation',
                  label: 'הסבר בעל עניין',
                  type: 'textarea',
                  admin: {
                    condition: (_, siblingData) => siblingData.isInterested === true,
                  },
                },
                {
                  name: 'isSeniorOfficial',
                  label: 'נושא משרה בכירה',
                  type: 'checkbox',
                  defaultValue: false,
                },
                {
                  name: 'seniorOfficialExplanation',
                  label: 'הסבר נושא משרה בכירה',
                  type: 'textarea',
                  admin: {
                    condition: (_, siblingData) => siblingData.isSeniorOfficial === true,
                  },
                },
                {
                  name: 'isInstitutionalInvestor',
                  label: 'משקיע מוסדי',
                  type: 'checkbox',
                  defaultValue: true,
                },
              ],
            },
            {
              name: 'votes',
              label: 'סעיפי הצבעה',
              type: 'array',
              labels: {
                singular: 'נושא',
                plural: 'נושאים',
              },
              admin: {
                components: {
                  RowLabel: {
                    path: '/collections/votes/components/RowLabel',
                  },
                },
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'topicIndex',
                      label: 'מספר נושא',
                      type: 'number',
                      required: true,
                      admin: { width: '100px', hidden: true },
                    },
                    {
                      name: 'voteDecision',
                      interfaceName: 'VoteDecision',
                      label: 'הצבעה',
                      type: 'select',
                      options: [
                        { label: '----', value: '----' },
                        { label: 'בעד', value: 'בעד' },
                        { label: 'נגד', value: 'נגד' },
                        { label: 'נמנע', value: 'נמנע' },
                        { label: 'אין חובת השתתפות', value: 'אין חובת השתתפות' },
                        { label: 'דיון', value: 'דיון' },
                        { label: 'לא משתתף', value: 'לא משתתף' },
                      ],
                      defaultValue: '----',
                      admin: { width: '15%', className: 'voteDecision' },
                    },
                    {
                      name: 'hasConflictOfInterest',
                      label: 'ניגוד עניינים',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '120px' },
                    },
                    {
                      name: 'isRelatedParty',
                      label: 'צד קשור',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '120px' },
                    },

                    {
                      name: 'isInvestmentCommittee',
                      label: 'ועדה',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: { width: '120px' },
                    },
                    {
                      name: 'hasPersonalInterest',
                      label: 'עניין אישי',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '120px' },
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'relatedPartyExplanation',
                      label: 'הסבר ניגוד עניינים',
                      type: 'textarea',
                      admin: {
                        condition: (_, siblingData) => siblingData.hasConflictOfInterest === true,
                        width: '33%',
                      },
                    },
                    {
                      name: 'conflictOfInterestExplanation',
                      label: 'הסבר צד קשור',
                      type: 'textarea',
                      admin: {
                        condition: (_, siblingData) => siblingData.isRelatedParty === true,
                        width: '33%',
                      },
                    },
                    {
                      name: 'personalInterestExplanation',
                      label: 'הסבר עניין אישי',
                      type: 'textarea',
                      admin: {
                        condition: (_, siblingData) => siblingData.hasPersonalInterest === true,
                        width: '33%',
                      },
                    },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'voteDocuments',
                  label: 'מסמכים מצורפים',
                  type: 'relationship',
                  relationTo: 'documents',
                  hasMany: true,
                },
                {
                  name: 'clientComment',
                  label: 'הערת לקוח',
                  type: 'textarea',
                },
              ],
            },
          ],
        },
        {
          label: 'הצבעה בפועל',
          fields: [
            {
              name: 'reported',
              label: 'הצבעה בפועל',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'reportedBy',
              label: 'דווח על ידי',
              type: 'text',
              admin: {
                hidden: true,
              },
            },
            {
              name: 'reportedTime',
              label: 'תאריך דיווח',
              type: 'date',
              admin: {
                hidden: true,
              },
            },
            {
              name: 'fundsWithHoldingsUpdates',
              label: 'עדכוני אחזקות תיקים',
              type: 'json',
              //hidden: true,
              defaultValue: {},
              admin: {
                components: {
                  Field: '/collections/votes/components/HoldingsInFunds',
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
      async ({ doc, req, previousDoc }) => {
        if (doc._status === 'published' && doc._status !== previousDoc?._status) {
          try {
            let meeting: Meeting | string = doc.meeting
            if (typeof meeting === 'string') {
              meeting = await req.payload.findByID({
                collection: 'meetings',
                id: meeting,
              })
            }

            if (meeting?.holdingsLimit) {
              const holdingsLimit = new Date(meeting.holdingsLimit)
              const dayAfterHoldings = addDays(holdingsLimit, 1)

              if (new Date() > dayAfterHoldings) {
                const meetingName = meeting?.fullName
                const message = `הצבעה חדשה פורסמה לאחר המועד הקובע עבור ${meetingName}`
                const url = `/admin/collections/votes/${doc.id}`
                const relatedCompany = getIdOfRelationField(doc.company)

                try {
                  await req.payload.delete({
                    collection: 'admin-notifications',
                    where: {
                      relatedCompany: { equals: relatedCompany },
                      message: { equals: message },
                      url: { equals: url },
                      user: { equals: req?.user?.id },
                    },
                  })
                } catch (error) {
                  req.payload.logger.error(
                    `Error deleting admin notification: ${JSON.stringify(error)}`,
                  )
                }

                await createAdminNotification(
                  req.payload,
                  message,
                  'newVoteAfterHoldingLimit',
                  url,
                  relatedCompany as string,
                  req?.user?.id
                )
              }
            }
          } catch (error) {
            console.error('Error creating notification for published vote:', error)
          }
        }
      },
    ],
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (data._status === 'published' && data.reported && !originalDoc?.reported) {
          data.reportedBy = data.updator || req.user?.name
          data.reportedTime = new Date().toISOString()
        }

        if (
          data._status === 'published' &&
          data.meeting &&
          data.fundsWithHoldingsUpdates &&
          JSON.stringify(originalDoc?.fundsWithHoldingsUpdates) !==
            JSON.stringify(data.fundsWithHoldingsUpdates)
        ) {
          try {
            const meetingId = data.meeting
            const updates = data.fundsWithHoldingsUpdates

            if (meetingId && typeof updates === 'object') {
              const meeting = await req.payload.findByID({
                collection: 'meetings',
                id: meetingId,
                depth: 0,
              })

              if (!meeting) {
                throw new Error('לא נמצאה אסיפה מתאימה')
              }

              const updatedFundsWithHolding = (meeting.fundsWithHolding || []).map((fund: any) => {
                const update = updates[fund.fund]

                if (update) {
                  return {
                    ...fund,
                    ownedQuantity:
                      update.ownedQuantity !== undefined && update.ownedQuantity !== null
                        ? update.ownedQuantity
                        : 0,
                  }
                }
                return fund
              })

              await req.payload.update({
                collection: 'meetings',
                id: meetingId,
                data: {
                  fundsWithHolding: updatedFundsWithHolding,
                },
                req,
              })
            }
          } catch (error) {
            console.error('Error updating meeting:', error)
            throw new Error('Failed to update meeting fundsWithHolding')
          }
        }
        return data
      },
    ],
    beforeValidate: [
      async ({ data }) => {
        const updates = data?.fundsWithHoldingsUpdates

        const validationErrors: { message: string; path: string }[] = []

        if (updates && typeof updates === 'object') {
          type FundUpdate = { isAuthorized?: string; ownedQuantity?: number | null }
          Object.entries(updates).forEach(([fundId, updateRaw]) => {
            const update = updateRaw as FundUpdate
            if (
              update &&
              update.isAuthorized === 'unchecked' &&
              (update.ownedQuantity === null || update.ownedQuantity === undefined)
            ) {
              validationErrors.push({
                message: 'חובה להזין ערך נקוב ברשות כאשר אין תאום בערכים',
                path: `reported`,
              })
            }
          })
        }

        if (validationErrors.length > 0) {
          throw new ValidationError({ errors: validationErrors })
        }

        return data
      },
    ],
  },
  endpoints: [
    {
      path: '/by-meeting-and-companies',
      method: 'get',
      handler: getVoteByMeetingAndCompanies,
    },
    {
      path: '/voted-companies',
      method: 'get',
      handler: getVotedCompanies,
    },
    {
      path: '/upsert-draft',
      method: 'post',
      handler: upsertVote,
    },
    {
      path: '/publish-votes',
      method: 'post',
      handler: publishVotes,
    },
    {
      path: '/voting-percentages',
      method: 'post', // it get method use post for boy
      handler: getVotingPercentages,
    },
  ],
  indexes: [
    {
      fields: ['meeting', 'company'],
      unique: true,
    },
  ],
}
