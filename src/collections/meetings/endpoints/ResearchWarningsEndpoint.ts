import { PayloadRequest } from 'payload'
import { parseResearchFilename } from '@/utils/parseResearchFilename'

const companyIsNotRegular = async (companyName: string, req: PayloadRequest): Promise<boolean> => {
  const result = await req.payload.find({
    collection: 'companies',
    where: {
      name: { like: companyName },
      type: { equals: 'regular' },
    },
    limit: 1,
    depth: 0,
  })
  return result.docs.length === 0
}

export default async function ResearchWarningsEndpoint(req: PayloadRequest) {
  try {
    const meetingId = req.routeParams?.id
    console.log("meetingId",meetingId)
    if (!meetingId) {
      return Response.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    // Get meeting data
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId as string,
      depth: 1,
    })
    console.log("meeting",meeting)
    if (!meeting) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const warnings: Array<{ message: string; type: 'warning' | 'error' }> = []
    
    // Check if we have POST data with current research documents and companies
    let docIDs = meeting.researchDocuments || []
    let companies = meeting.companies || []
    
    if (req.method === 'POST' && req.json) {
      try {
        const body = await req.json()
        
        // Use current research documents from POST body if provided
        if (body.researchDocuments && Array.isArray(body.researchDocuments)) {
          docIDs = body.researchDocuments.map((doc: any) => 
            typeof doc === 'string' ? doc : doc.id
          ).filter(Boolean)
          console.log("Using current research documents from POST:", docIDs)
        }
        
        // Use current companies from POST body if provided
        if (body.companies && Array.isArray(body.companies)) {
          companies = body.companies.map((company: any) => 
            typeof company === 'string' ? company : company.id
          ).filter(Boolean)
          console.log("Using current companies from POST:", companies)
        }
      } catch (error) {
        console.log("Failed to parse POST body, using meeting data:", error)
      }
    }
    

    if (!Array.isArray(docIDs) || docIDs.length === 0) {
      return Response.json({ warnings })
    }

    // Get research documents
    const { docs: researchDocs } = await req.payload.find({
      collection: 'research-documents',
      select: { companies: true, filename: true },
      depth: 0,
      limit: 0,
      where: { id: { in: docIDs } },
    })

    type ResearchDoc = { id: string; companies?: string[]; filename?: string }
    const docs = researchDocs as ResearchDoc[]

    // Check for multiple general documents
    if (docIDs.length > 1) {
      const generalDocs = docs.filter((doc) => !doc.companies || doc.companies.length === 0)
      const invalidGeneral: string[] = []
      
      for (const doc of generalDocs) {
        const filename = doc.filename || ''
        const result = parseResearchFilename(filename)
        const companyExists =
          result.isValid &&
          !result.isGeneric &&
          result.companyName &&
          (await companyIsNotRegular(result.companyName, req))
        
        if (companyExists) {
          warnings.push({
            message: `המסמך "${filename}" מתייחס לחברה לא קיימת במערכת`,
            type: 'warning'
          })
        } else {
          invalidGeneral.push(doc.id)
        }
      }
      
      if (invalidGeneral.length > 1) {
        warnings.push({
          message: 'יש יותר ממסמך מחקר כללי אחד - מומלץ להשאיר רק אחד',
          type: 'warning'
        })
      }
    }

    // Check for companies not invited to this meeting
    const invalidFilenames: string[] = []
    docs.forEach((doc) => {
      if (!doc.companies || doc.companies.length === 0) return
      const unmatched = doc.companies.filter((c) => !companies.includes(c))
      if (unmatched.length > 0 && doc.filename) {
        invalidFilenames.push(doc.filename)
      }
    })
    
    if (invalidFilenames.length === 1) {
      warnings.push({
        message: `${invalidFilenames[0]} - מסמך זה מכיל חברות שאינן מוזמנות לפגישה זו`,
        type: 'warning'
      })
    } else if (invalidFilenames.length > 1) {
      const list = invalidFilenames.map((f) => `- ${f}`).join('\n')
      warnings.push({
        message: `מסמכים אלו מכילים חברות שאינן מוזמנות לפגישה זו:\n${list}`,
        type: 'warning'
      })
    }

    // Check for duplicate companies across documents
    const companyToDocsMap: Record<string, string[]> = {}
    docs.forEach((doc) => {
      const name = doc.filename || 'מסמך ללא שם'
      doc.companies?.forEach((cid) => {
        if (!companyToDocsMap[cid]) companyToDocsMap[cid] = []
        companyToDocsMap[cid].push(name)
      })
    })
    
    const duplicates = Object.entries(companyToDocsMap).filter(([, files]) => files.length > 1)
    if (duplicates.length > 0) {
      // Get company names
      const dupIds = duplicates.map(([cid]) => cid)
      const { docs: companyDocs } = await req.payload.find({
        collection: 'companies',
        select: { id: true, name: true },
        depth: 0,
        limit: 0,
        where: { id: { in: dupIds } },
      })
      
      const idToName = Object.fromEntries(
        (companyDocs as { id: string; name?: string }[]).map((c) => [c.id, c.name || c.id]),
      )
      
      if (duplicates.length === 1) {
        const [cid, files] = duplicates[0]
        const list = files.map((f) => `- ${f}`).join('\n')
        warnings.push({
          message: `החברה "${idToName[cid]}" מופיעה ביותר ממסמך אחד:\n${list}`,
          type: 'warning'
        })
      } else {
        const groups = duplicates
          .map(([cid, files]) => {
            const header = `החברה "${idToName[cid]}" מופיעה ב־${files.length} מסמכים:`
            const list = files.map((f) => `  - ${f}`).join('\n')
            return `${header}\n${list}`
          })
          .join('\n\n')
        warnings.push({
          message: `החברות הבאות מופיעות ביותר ממסמך אחד:\n\n${groups}`,
          type: 'warning'
        })
      }
    }

    return Response.json({ warnings })

  } catch (error) {
    console.error('Error checking research document warnings:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}