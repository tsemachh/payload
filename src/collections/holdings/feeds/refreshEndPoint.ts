
import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { initializeValidationResult, loadValidationData, runValidationLoop } from './FeedValidationService';


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
 //const standardizedRecords = await req?.json()

  console.log("-----@@@companies", companies);
  console.log("-----@@@records", standardizedRecords);

  // Ensure we have an array to work with
  const recordsArray: any[] = Array.isArray(standardizedRecords)
    ? standardizedRecords
    : standardizedRecords
      ? [standardizedRecords]
      : [];

  console.log("-----@@@recordsArray", recordsArray);

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

  console.log("-----@@@selectedCompanies", selectedCompanies);


  const validationResult = initializeValidationResult();

  const {
    accountToCompanyMap,
    stockMap,
    silencedStockIds
  } = await loadValidationData(
    req,
    selectedCompanies,
    recordsArray
  );

  await runValidationLoop(
    recordsArray,
    accountToCompanyMap,
    stockMap,
    silencedStockIds,
    validationResult
  );

  console.log("-----@@@validationResult.silencedRecords", validationResult.silencedRecords);
  console.log("-----@@@validationResult.validRecords", validationResult.validRecords);
  console.log("-----@@@validationResult", validationResult);


    return Response.json({
      validationResult,
    })
}


export default refreshEndPoint;
