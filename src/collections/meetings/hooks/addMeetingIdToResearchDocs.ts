import { CollectionAfterChangeHook } from 'payload';

export const addMeetingIdToResearchDocs: CollectionAfterChangeHook = async ({ doc,req}) => {
    console.log("-------------- doc.upload",doc.upload)

    console.log("-------------- doc.meetingId",doc.meetingId)

  const researchDocIds = doc.upload?.map((u: { id: any; }) => (typeof u === 'object' ? u.id : u)) ?? [];
console.log("-------------- researchDocIds",researchDocIds)
  await Promise.all(
    researchDocIds.map(async (id: any) => {
      await req.payload.update({
        collection: 'research-documents',
        id: id,
        data: {
          meeting: doc.id, 
        },
      });
    })
  );
  console.log("-------------- doc",doc)

  return doc;
};
