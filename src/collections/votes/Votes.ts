import { type CollectionConfig } from 'payload'
import { createAdminNotification } from '@/utils/utils'
import { addDays, isSameDay } from '@/utils/dateUtils'
import { Meeting } from '@/payload-types'
import { getVoteByMeetingAndCompanies, upsertVote } from './voteEndPoint'

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
    useAsTitle: 'meeting',
    defaultColumns: ['meeting', 'companies'],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200],
    },
  },
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
          filterOptions: {
            type: { equals: 'regular' },
          },
        },
      ],
    },
    {
      name: 'noParticipantDuty',
      label: 'אין חובת השתתפות',
      type: 'checkbox',
      defaultValue: false,
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
    {
      name: 'clientComment',
      label: 'הערת לקוח',
      type: 'textarea',
    },
    {
      name: 'votes',
      label: 'הצבעות',
      type: 'array',
      labels: {
        singular: 'הצבעה',
        plural: 'הצבעות',
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
              name: 'hasConflictOfInterest',
              label: 'ניגוד עניינים',
              type: 'checkbox',
              defaultValue: true,
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
              defaultValue: false,
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
  ],
  hooks: {
    // beforeValidate: [
    //   async ({ data, operation, req }) => {
    //     if (operation === 'create' || operation === 'update') {
    //       if (!data) return data
    //       const { meeting, company } = data

    //       if (meeting && company) {
    //         const existingVotes = await req.payload.find({
    //           collection: 'votes',
    //           where: {
    //             and: [{ meeting: { equals: meeting } }, { company: { equals: company } }],
    //           },
    //         })

    //         const isDuplicate = existingVotes.docs.some((vote) => vote.id !== data.id)

    //         if (isDuplicate) {
    //           throw new Error(`כבר קיימת הצבעה עבור האסיפה והחברה האלה.`)
    //         }
    //       }
    //     }
    //     return data
    //   },
    // ],
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
      path: '/upsert-draft',
      method: 'post',
      handler: upsertVote,
    },
  ],
}
