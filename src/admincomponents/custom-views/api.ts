import { Company } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'

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
    // Add company to companyIdToNameMap
    if (doc.id && doc.name) {
      companyIdToNameMap.set(doc.id as string, doc.name as string)
    }

    doc?.subCompanies?.forEach((subCompany) => {
      if (subCompany) {
        const id: string = getIdOfRelationField(subCompany) as string
        // Add fund to fundIdToNameMap
        if (id && typeof subCompany === 'object' && subCompany.name) {
          fundIdToNameMap.set(id, subCompany.name as string)
        }
      }
    })
  })
  const fundsWithHolding = meetingData.fundsWithHolding.filter((fundHold: any) => {
    return companiesIdsArray.includes(fundHold.company)
  })

  const fundsWithHoldings = fundsWithHolding.map((fundHold: any) => {
    return {
      company: { id: fundHold.company, name: companyIdToNameMap.get(fundHold?.company) },
      fund: { id: fundHold.fund, name: fundIdToNameMap.get(fundHold?.fund) },
      quantity: fundHold.quantity || 0,
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
