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
          name: 'topicIndex',
          label: 'מספר נושא',
          type: 'number',
          required: true,
        },
        {
          name: 'votingOptions',
          label: 'אפשרויות הצבעה',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'בעד', value: 'for' },
            { label: 'נגד', value: 'against' },
            { label: 'נמנע', value: 'avoid' },
            { label: 'אין חובת השתתפות', value: 'no-obligation' },
            { label: 'לא משתתף', value: 'not-participating' },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
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
                votingOptions: [],
              }));
            }
          } catch (error) {
            console.error('Error fetching meeting agenda:', error);
          }
        }
        
        return data;
      },
    ],
  },
}