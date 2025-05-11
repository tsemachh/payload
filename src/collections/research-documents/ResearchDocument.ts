import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

// Function to parse research document filename
const parseResearchFilename = (fileName: string): { meetingId: string; companyName: string | null; isValid: boolean } => {

  const privatePattern = /^מחקר(\d+)_(.+)\.(pdf|docx)$/;
  const genericPattern = /^מחקר(\d+)\.(pdf|docx)$/;
  

  const privateMatches = fileName.match(privatePattern);
  if (privateMatches) {
    return {
      meetingId: privateMatches[1],
      companyName: privateMatches[2],
      isValid: true,
    };
  }

  const genericMatches = fileName.match(genericPattern);
  if (genericMatches) {
    return {
      meetingId: genericMatches[1],
      companyName: null,
      isValid: true,
    };
  }

  return {
    meetingId: '',
    companyName: null,
    isValid: false,
  };
};

// Hook to set meeting and company based on filename
const setMeetingAndCompanyFromFilename: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data?.filename) return data;

  const parsedData = parseResearchFilename(data.filename);

  if (!parsedData.isValid) {
    throw new Error('Invalid research document filename format. Expected format: מחקר<מספר אסיפה>.pdf or מחקר<מספר אסיפה>_<שם חברה>.pdf');
  }

  // Find meeting by meetingId
  const meetingResponse = await req.payload.find({
    collection: 'meetings',
    where: {
      meetingId: { equals: parsedData.meetingId },
    },
  });

  if (meetingResponse.docs.length === 0) {
    throw new Error(`Meeting with ID ${parsedData.meetingId} not found`);
  }

  // Set meeting relation
  data.meeting = meetingResponse.docs[0].id;

  // If company name is provided, find and set company relation
  if (parsedData.companyName) {
    const companyResponse = await req.payload.find({
      collection: 'companies',
      where: {
        name: { equals: parsedData.companyName },
      },
    });

    if (companyResponse.docs.length === 0) {
      throw new Error(`Company with name ${parsedData.companyName} not found`);
    }

    // Check if company is eligible to receive research documents
    const company = companyResponse.docs[0];

    // Set company relation
    data.company = company.id;
  }

  return data;
};

export const ResearchDocument: CollectionConfig = {
  slug: 'research-documents',
  labels: {
    plural: 'מסמכי מחקר',
    singular: 'מסמך מחקר',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'meeting', 'company', 'uploadedAt'],
    listSearchableFields: ['filename', 'meeting', 'company'],
  },
  access: {
    admin: ({ req: { user } }) => {
      return Boolean(user)
    }, },
  upload: {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'],
  },
  fields: [
    {
      name: 'meeting',
      label: 'אסיפה',
      type: 'relationship',
      relationTo: 'meetings',
      required: true,
      index: true,
      admin:{readOnly:true}
    },
    {
      name: 'company',
      label: 'חברה',
      type: 'relationship',
      relationTo: 'companies',
      index: true,
      admin:{readOnly:true}
    },
    {
      name: 'uploadedAt',
      label: 'תאריך העלאה',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'dd/MM/yyyy HH:mm',
        },
        readOnly:true
      },
      defaultValue: () => new Date(),
    },
  ],
  hooks: {
    beforeValidate: [setMeetingAndCompanyFromFilename],
  },
}
