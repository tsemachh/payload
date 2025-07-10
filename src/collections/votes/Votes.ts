import { type CollectionConfig } from 'payload'
import { createAdminNotification } from '@/utils/utils'
import { addDays, isSameDay } from '@/utils/dateUtils'
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
    group: 'פעילות',
  },
  disableBulkEdit: true,
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
          type: 'text', // Stored in the database
          admin: {
            hidden: true, // Hide in admin UI to prevent manual edits
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
        {
          name: 'reported',
          label: 'דווח',
          type: 'checkbox',
          defaultValue: false,
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
              admin: { width: '100px' },
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
                { label: 'דיון', value: 'דיון' },
                { label: 'לא משתתף', value: 'לא משתתף' },
              ],
              defaultValue: '----',
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'noParticipantDuty',
              label: 'אין חובת השתתפות',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'hasConflictOfInterest',
              label: 'ניגוד עניינים',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'conflictOfInterestExplanation',
              label: 'הסבר צד קשור',
              type: 'textarea',
              admin: {
                condition: (_, siblingData) => siblingData.hasConflictOfInterest === true,
              },
            },
            {
              name: 'isRelatedParty',
              label: 'צד קשור',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'relatedPartyExplanation',
              label: 'הסבר צד קשור',
              type: 'textarea',
              admin: {
                condition: (_, siblingData) => siblingData.relatedParty === true,
              },
            },
            {
              name: 'isInvestmentCommittee',
              label: 'ועדה',
              type: 'checkbox',
              defaultValue: true,
            },
            {
              name: 'hasPersonalInterest',
              label: 'עניין אישי',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'personalInterestExplanation',
              label: 'הסבר עניין אישי',
              type: 'textarea',
              admin: {
                condition: (_, siblingData) => siblingData.hasPersonalInterest === true,
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
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        if (doc._status === 'published') {
          try {
            let meeting: Meeting | string = doc.meeting
            if (typeof meeting === 'string')
              meeting = await req.payload.findByID({
                collection: 'meetings',
                id: meeting,
              })

            if (meeting?.holdingsLimit) {
              const holdingsLimit = new Date(meeting.holdingsLimit)
              const dayAfterHoldings = addDays(holdingsLimit, 1)

              if (isSameDay(new Date(), dayAfterHoldings)) {
                const meetingName = meeting?.fullName
                const message = `הצבעה חדשה פורסמה עבור ${meetingName}`
                const url = `/admin/collections/votes/${doc.id}`
                //TODO ask @philc if we need to put hte first company in the notification
                const relatedCompany = doc.companies?.[0]
                  ? typeof doc.companies[0] === 'string'
                    ? doc.companies[0]
                    : doc.companies[0].id
                  : undefined

                await createAdminNotification(
                  req.payload,
                  message,
                  url,
                  relatedCompany,
                  req?.user?.id,
                )
              }
            }
          } catch (error) {
            console.error('Error creating notification for published vote:', error)
          }
        }
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
