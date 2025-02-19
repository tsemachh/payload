import { addDataAndFileToRequest } from 'payload'
import {PayloadRequest} from 'payload'
import ImportStock   from '@/collections/stocks/imports/ImportStock'

const ImportEndPoint=async (req:PayloadRequest) => {
  await addDataAndFileToRequest(req)
  if (req === null) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!req.user) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  // @ts-ignore
  const data = await req.json()
  const stocks:ImportStock[] = data as ImportStock[]
  console.log("Stocks",JSON.stringify(stocks))
    // do something



  return Response.json({
    message: 'successfully updated stocks info'
  })
}

export default ImportEndPoint