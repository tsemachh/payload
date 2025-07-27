import { type CollectionConfig } from 'payload'

import { TopicVote, Vote } from '@/payload-types'

import {
  getVoteByMeetingAndCompanies,
  getVotedCompanies,
  publishVotes,
  upsertVote,
} from './voteEndPoint'
import { getVotingPercentages } from './votingPercentagesEndPoint'
import { updateReportedAndMeetingHoldings, validateOwnedQuantityWhenUnauthorized } from './hooks'

function calculateCheckSum(data: Vote) {
  // Create a string representation of the fields to compute checksum
  const checksumData = {
    // Basic fields
    isInterested: data.isInterested || false,
    isSeniorOfficial: data.isSeniorOfficial || false,
    isInstitutionalInvestor: data.isInstitutionalInvestor || false,
    interestedExplanation: data.interestedExplanation || null,
    seniorOfficialExplanation: data.seniorOfficialExplanation || null,

    // Votes array fields
    votes: (data.votes || []).map((vote: NonNullable<TopicVote>[number]) => ({
      topicIndex: vote.topicIndex,
      voteDecision: vote.voteDecision,
      hasConflictOfInterest: vote.hasConflictOfInterest || false,
      isRelatedParty: vote.isRelatedParty || false,
      isInvestmentCommittee: vote.isInvestmentCommittee || false,
      hasPersonalInterest: vote.hasPersonalInterest || false,
      relatedPartyExplanation: vote.relatedPartyExplanation || null,
      conflictOfInterestExplanation: vote.conflictOfInterestExplanation || null,
      personalInterestExplanation: vote.personalInterestExplanation || null,
    })),
  }

  // Convert to string and create a simple hash
  const checksumString = JSON.stringify(checksumData)

  // Create a simple hash from the string
  let hash = 0
  for (let i = 0; i < checksumString.length; i++) {
    const char = checksumString.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return hash.toString(16) // Return as hex string
}

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
                          try {
                            const company = await req.payload.findByID({
                              collection: 'companies',
                              select: {
                                name: true,
                              },
                              id: data.company,
                              depth: 0,
                            })
                            return `הצבעה ${company?.name || 'ללא שם חברה'}`
                          } catch (error) {
                            // Handle case when company is not found
                            return `הצבעה ללא שם חברה`
                          }
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
                  name: 'checksum',
                  type: 'text',
                  admin: {
                    hidden: true,
                  },
                  hooks: {
                    afterRead: [
                      async ({ data }) => {
                        if (!data) return null
                        return calculateCheckSum(data as Vote)
                      },
                    ],
                  },
                },
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
              type: 'row',
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
              ],
            },
            {
              type: 'row',
              fields: [
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

            {
              name: 'votes',
              label: 'סעיפי הצבעה',
              type: 'array',
              labels: {
                singular: 'נושא',
                plural: 'נושאים',
              },
              interfaceName: 'TopicVote',
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
      ],
    },
  ],
  hooks: {
    beforeChange: [updateReportedAndMeetingHoldings],
    beforeValidate: [validateOwnedQuantityWhenUnauthorized],
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
