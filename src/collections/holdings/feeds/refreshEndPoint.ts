
import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { processValidationData } from './FeedValidationService';
import { FeedValidationResult } from '@/collections/holdings/feeds/FeedTypes';


const refreshEndPoint = async (req: PayloadRequest) => {
  const { companies } = req.query;
  await addDataAndFileToRequest(req)
  if (req === null) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!req.user) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  // @ts-expect-error req not null
  const standardizedRecords = await req.json()


  // Ensure we have an array to work with
  const recordsArray: any[] = Array.isArray(standardizedRecords)
    ? standardizedRecords
    : standardizedRecords
      ? [standardizedRecords]
      : [];


  // Parse companies parameter
  let selectedCompanies: string[] = [];
  if (companies) {
    try {
      selectedCompanies = Array.isArray(companies)
        ? companies
        : typeof companies === 'string'
          ? companies.includes('[')
            ? JSON.parse(companies)
            : companies.split(',')
          : [];
    } catch (e) {
      console.error("Error parsing companies parameter:", e);
      selectedCompanies = (companies as string).split(',');
    }
  }


  const validationResult: FeedValidationResult = {
    fatalErrors: [],
    warnings: [],
    recordErrors: [],
    validRecords: [],
    silencedRecords: [],
  }

  await processValidationData(req, selectedCompanies, recordsArray,validationResult);


    return Response.json({
      validationResult,
    })
}


export default refreshEndPoint;
