import { PayloadRequest } from 'payload'

// פונקציה לבדוק הרשאות
const checkUserAuthorization = (req: PayloadRequest) => {
  if (!req?.user) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
}

// פונקציה לבדוק תקינות הערכים ב-query
const validateQueryParams = (stockId: string, companiesArray: string[]) => {
  if (typeof stockId !== 'string' || !stockId) {
    return Response.json({ error: 'Missing or invalid stockId' }, { status: 400 })
  }
  if (!Array.isArray(companiesArray)) {
    return Response.json({ error: 'Missing or invalid companies' }, { status: 400 });
  }
}

// פונקציה למציאת המניה
const findExistingStock = async (req: PayloadRequest, stockId: string) => {
  const existingStock = await req.payload.find({
    collection: 'silenced-stocks',
    where: { stockId: { equals: stockId } },
    depth: 0,
    limit: 1,
  })
  return existingStock.docs[0]
}

// פונקציה לעדכון מניה קיימת
const updateSilencedStock = async (req: PayloadRequest, stockId: string, companies: string[], existingStock: any) => {
  return await req.payload.update({
    collection: 'silenced-stocks',
    id: existingStock.id,
    data: {
      companies: Array.from(new Set([...(existingStock.companies || []), ...companies])),
    },
  })
}

// פונקציה ליצירת מניה חדשה
const createSilencedStock = async (req: PayloadRequest, stockId: string, companies: string[]) => {
  return await req.payload.create({
    collection: 'silenced-stocks',
    data: { stockId, companies },
  })
}

// הפונקציה המרכזית
const upsertSilencedStocksEndPoint = async (req: PayloadRequest) => {
  try {
    // בדיקת הרשאות
    const authError = checkUserAuthorization(req)
    if (authError) return authError

    const { stockId, companies } = req.query as { stockId: string; companies: string }
    const companiesArray = companies.split(',');
    console.log(companiesArray);
    // בדיקת תקינות הערכים
    const queryParamError = validateQueryParams(stockId, companiesArray)
    if (queryParamError) return queryParamError

    // מציאת מניה קיימת
    const existingStock = await findExistingStock(req, stockId)

    // אם המניה קיימת, עדכון; אחרת, יצירת מניה חדשה
    let result
    if (existingStock) {
      result = await updateSilencedStock(req, stockId, companiesArray, existingStock)
    } else {
      result = await createSilencedStock(req, stockId, companiesArray)
    }

    return Response.json({ feedResult: result })
  } catch (error) {
    console.error('Error processing silenced stock:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export default upsertSilencedStocksEndPoint
