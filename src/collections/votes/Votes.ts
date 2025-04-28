import { type CollectionConfig } from 'payload'

export const Votes: CollectionConfig = {
  slug: 'votes',
  labels: {
    plural: 'הצבעות',
    singular: 'הצבעה',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'meeting',
    defaultColumns: [
      'meeting',
      'companies',
    ],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200],
    },
  },
  versions: {
  },
  fields: [
    {
      type:"row",
      fields:[
        {
          name: 'meeting',
          label: 'אסיפה',
          type: 'relationship',
          relationTo: 'meetings',
          required: true,
          index: true,
        },
        {
          name: 'companies',
          label: 'חברות',
          type: 'relationship',
          relationTo: 'companies',
          hasMany: true,
          required: true,
          index: true,
        },
      ]
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
          fields:[
            {
              name: 'topicIndex',
              label: 'מספר נושא',
              type: 'number',
              required: true,
              admin:{width:'100px'}
            },
            {
              name: 'voteDecision',
              label: 'הצבעה',
              type: 'select',
              options: [
                { label: 'בעד', value: 'בעד' },
                { label: 'נגד', value: 'נגד' },
                { label: 'נמנע', value: 'נמנע' },
                { label: 'אין חובת השתתפות', value: 'אין חובת השתתפות' },
                { label: 'לא משתתף', value: 'לא משתתף' },
                { label: 'דיון', value: 'דיון' },
                { label: 'הוסר מסדר היום', value: 'הוסר מסדר היום' },
                { label: 'ללא הצבעה', value: 'ללא הצבעה' },
                { label: 'נמכרה אחזקה', value: 'נמכרה אחזקה' },
                { label: 'הצבעות סותרות', value: 'הצבעות סותרות' },
              ],
            },
          ]
        },
        {
          type:'row',
          fields:[
            {
              name: 'committee',
              label: 'ועדה',
              type: 'checkbox',
            },
            {
              name: 'conflict',
              label: 'ניגוד עניינים',
              type: 'checkbox',
            },
            {
              name: 'relatedParty',
              label: 'צד קשור',
              type: 'checkbox',
            },
            {
              name: 'personalInterest',
              label: 'עניין אישי',
              type: 'checkbox',
            },
          ]
        },
        {
          name: 'professionalFactor',
          label: 'גורם מקצועי',
          type: 'text',
        },
        {
          name: 'comment',
          label: 'הערה',
          type: 'textarea',
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
/*    beforeChange: [
      async ({ data, req }) => {
        // If meeting is provided, fetch its agenda to populate the votes array

        if (data.meeting) {
          try {
            const meeting = await req.payload.findByID({
              collection: 'meetings',
              id: data.meeting,
            });

            // If meeting has agenda, create a vote entry for each topic
            if (meeting.agenda && Array.isArray(meeting.agenda)) {
              data.votes = meeting.agenda.map((topic, index) => ({
                topicIndex: index + 1,
                voteDecision: null,
                comment: '',
                clientComment: '',
                committee: false,
                conflict: false,
                relatedParty: false,
                personalInterest: false,
                professionalFactor: '',
              }));
            }
          } catch (error) {
            console.error('Error fetching meeting agenda:', error);
          }

        }

        return data;
      },
    ],*/
  },
}
