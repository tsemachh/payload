import { Company } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'
import { getParentCompanyId } from '@/utils/voteGrouping'

export async function getVoteData(req: any, meetingId: string, companyIds: string) {
  const companiesIdsArray = (companyIds as string).split(',')

  const meetingData = await req.payload.findByID({
    collection: 'meetings',
    id: meetingId,
    select: {
      fundsWithHolding: true,
      fullName: true,
      agenda: true,
      meetingDate: true,
      holdingsLimit: true,
    },
    depth: 0,
    limit: 0,
  })
  const voteData = await req.payload.find({
    collection: 'votes',
    where: {
      and: [
        { meeting: { equals: meetingId } },
        { company: { in: companiesIdsArray } },
        { _status: { equals: 'published' } },
      ],
    },
    depth: 1,
    limit: 1,
  })

  // Validate that all votes have the same parentCompany and checksum
  if (voteData.docs.length > 0) {
    const firstVote = voteData.docs[0]
    const expectedParentCompanyId = getParentCompanyId(firstVote.parentCompany)
    const expectedChecksum = firstVote.checksum

    for (const vote of voteData.docs) {
      const voteChecksum = vote.checksum || vote.publishedchecksum
      const currentParentCompanyId = getParentCompanyId(vote.parentCompany)
      const voteIdentifier = `Vote ID: ${vote.id}, Company: ${vote.companyName || vote.company}`

      // Compare parent company IDs, not object references
      if (currentParentCompanyId !== expectedParentCompanyId) {
        throw new Error(
          `Vote grouping validation failed: ${voteIdentifier} has different parentCompany ID: ${currentParentCompanyId || 'null'} (expected: ${expectedParentCompanyId || 'null'})`,
        )
      }

      if (voteChecksum !== expectedChecksum) {
        throw new Error(
          `Vote grouping validation failed: ${voteIdentifier} has different checksum: ${voteChecksum || 'null'} (expected: ${expectedChecksum || 'null'})`,
        )
      }
    }
  }

  // Fetch company data for additional info needed for the page
  const companyData = await req.payload.find({
    collection: 'companies',
    where: {
      id: { in: companiesIdsArray },
    },
    select: {
      name: true,
      subCompanies: true,
      researchDocuments: { displayVotingRecommendation: true },
    },
    depth: 1,
    limit: 0,
  })

  const companyIdToNameMap: Map<string, string> = new Map()
  const fundIdToNameMap: Map<string, string> = new Map()
  companyData.docs.forEach((doc: Company) => {
    if (doc.id && doc.name) {
      companyIdToNameMap.set(doc.id as string, doc.name as string)
    }

    doc?.subCompanies?.forEach((subCompany) => {
      if (subCompany) {
        const id: string = getIdOfRelationField(subCompany) as string
        if (id && typeof subCompany === 'object' && subCompany.name) {
          fundIdToNameMap.set(id, subCompany.name as string)
        }
      }
    })
  })
  const fundsWithHolding = meetingData.fundsWithHolding.filter((fundHold: any) => {
    return companiesIdsArray.includes(fundHold.company)
  })

  const fundsWithHoldings = fundsWithHolding.flatMap((fundHold: any) => {
    const baseData = {
      company: { id: fundHold.company, name: companyIdToNameMap.get(fundHold?.company) },
      fund: { id: fundHold.fund, name: fundIdToNameMap.get(fundHold?.fund) },
    }

    if (fundHold.original && fundHold.original.length > 0) {
      // Return a row for each original stock entry
      return fundHold.original.map((o: any) => ({
        ...baseData,
        original: {
          stockId: o.stockId,
          quantity: o.quantity,
          ownedQuantity: o.ownedQuantity,
          verifiedHoldings: o.verifiedHoldings,
        },
      }))
    }
    // Return single row with regular data
    return {
      ...baseData,
      quantity: fundHold.quantity,
      ownedQuantity: fundHold.ownedQuantity,
      verifiedHoldings: fundHold.verifiedHoldings,
    }
  })

  return {
    ...voteData.docs[0],
    companies: companyData.docs.map((c: any) => c.name),
    displayVotingRecommendation: companyData.docs.some(
      (c: any) => c.researchDocuments?.displayVotingRecommendation === true,
    ),
    meeting: meetingData.fullName,
    meetingDate: meetingData.meetingDate,
    holdingsLimit: meetingData.holdingsLimit,
    fundsData: fundsWithHoldings,
    agenda: meetingData.agenda,
    meetingFullName: meetingData.fullName,
  }
}
