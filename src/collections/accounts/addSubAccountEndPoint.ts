import { PayloadRequest } from 'payload'
//
// const checkUserAuthorization = (req: PayloadRequest) => {
//   if (!req?.user) {
//     return Response.json({ error: 'forbidden' }, { status: 403 })
//   }
// }
//
// const validateQueryParams = (stockId: string, companiesArray: string[]) => {
//   if (typeof stockId !== 'string' || !stockId) {
//     return Response.json({ error: 'Missing or invalid stockId' }, { status: 400 })
//   }
//   if (!Array.isArray(companiesArray)) {
//     return Response.json({ error: 'Missing or invalid companies' }, { status: 400 });
//   }
// }
//
// const findExistingStock = async (req: PayloadRequest, stockId: string) => {
//   const existingStock = await req.payload.find({
//     collection: 'silenced-stocks',
//     where: { stockId: { equals: stockId } },
//     depth: 0,
//     limit: 1,
//   })
//   if (existingStock.docs.length===0 )return null
//   return existingStock.docs[0]
// }
//
// const updateSilencedStock = async (req: PayloadRequest, stockId: string, companies: string[], existingStock: any) => {
//   return await req.payload.update({
//     collection: 'silenced-stocks',
//     id: existingStock.id,
//     data: {
//       companies: Array.from(new Set([...(existingStock.companies || []), ...companies])),
//     },
//   })
// }
//
// const createSilencedStock = async (req: PayloadRequest, stockId: string, companies: string[]) => {
//   return await req.payload.create({
//     collection: 'silenced-stocks',
//     data: { stockId, companies },
//   })
// }

const addSubAccountEndPoint = async (req: PayloadRequest) => {
  try {
    // const authError = checkUserAuthorization(req)
    // if (authError) return authError

    const { accountId, companyId } = req.query as { accountId: string; companyId: string }
    // const queryParamError = validateQueryParams(stockId, companiesArray)
    // if (queryParamError) return queryParamError

    // const existingStock = await findExistingStock(req, stockId)
    //
    // let result
    // if (existingStock) {
    //   result = await updateSilencedStock(req, stockId, companiesArray, existingStock)
    // } else {
    //   result = await createSilencedStock(req, stockId, companiesArray)
    // }


console.log("-----accountId",accountId)
console.log("-----companyId",companyId)

    //return Response.json({ feedResult: result })
    return Response.json({ message: 'OK' }, { status: 200 })

  } catch (error) {
    console.error('Error processing silenced stock:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export default addSubAccountEndPoint
