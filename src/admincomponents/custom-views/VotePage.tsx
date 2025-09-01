import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { VotingForm } from './voting-form'
import { Company } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const GroupedVotesPage = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const {
    permissions,
    req,
    req: {
      payload,
      payload: {
        config: {
          routes: { admin: adminRoute },
        },
      },
      user,
    },
    visibleEntities,
  } = initPageResult

  // Optional: Redirect unauthorized users
  if (!user || (user && !permissions?.canAccessAdmin)) {
    return redirect(`${adminRoute}/unauthorized`)
  }

  async function getVoteData(req: any, meetingId: string, companyIds: string) {
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
        ownedQuantity: fundHold.ownedQuantity || 0,
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
    }
  }

  const meetingId = (searchParams?.meetingId || '') as string
  const companyIds = (searchParams?.companyIds || '') as string
  const voteData = await getVoteData(req, meetingId, companyIds)

  // Create navigation back to meeting
  const BackToMeetingAction = () => (
    <Link
      href={`${adminRoute}/collections/meetings/${meetingId}`}
      className="btn btn--style-secondary btn--size-small"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        marginLeft: '1rem',
        width: '24px',
        height: '22px',
        padding: '0',
      }}
      title="Back to Meeting"
    >
      <ArrowLeft size={16} />
    </Link>
  )

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
      viewActions={[BackToMeetingAction as any]}
    >
      <VotingForm voteData={voteData} meetingId={meetingId} companyIds={companyIds} />
    </DefaultTemplate>
  )
}
export default GroupedVotesPage
