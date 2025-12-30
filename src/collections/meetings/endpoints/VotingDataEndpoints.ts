import {
  getCompanyDataById,
  getManyCompanyDataByIds,
  getCompanyOrderMap,
} from '@/collections/meetings/hooks/activeCompaniesCache'
import { calculateHoldingValues } from '@/utils/dataUtils'
import { getIdOfRelationField } from '@/utils/utils'

interface VotedCompanyData {
  id: string
  name: string
  parentCompany: string
  parentCompanyId: string
  nominalValue: number
  percentageHolding: number
  hasRelatedStock: boolean
  passiveFunds: boolean
  vote: {
    id: string
    voter: string
    votedAt: string
    notes?: string
    reported?: boolean
    checksum?: string
  }
}

interface NotVotedCompanyData {
  id: string
  name: string
  parentCompany: string
  parentCompanyId: string
  nominalValue: number
  percentageHolding: number
  hasRelatedStock: boolean
  passiveFunds: boolean
}

interface HistoricalHoldingData {
  id: string
  companyId: string
  companyName: string
  lastHoldingDate: string
  quantity: number
  fundDetails: Array<{
    fundId: string
    fundName: string
    quantity: number
    lastHoldingDate: string
  }>
}

/**
 * Endpoint: GET /api/meetings/voting-data/voted-companies?meetingId=xxx
 * Fetches companies that have voted for a specific meeting
 */
export async function getVotedCompaniesEndpoint(req: any) {
  try {
    const meetingId = req.query.meetingId as string

    if (!meetingId) {
      return new Response(JSON.stringify({ error: 'Meeting ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch the meeting document
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      select: {
        companies: true,
        funds: true,
        stockValue: true,
        fundsWithHolding: true,
      },
      depth: 0,
    })

    if (!meeting) {
      return new Response(JSON.stringify({ error: 'Meeting not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch votes for this meeting
    const votesResult = await req.payload.find({
      collection: 'votes',
      where: {
        meeting: { equals: meetingId },
      },
      select: {
        id: true,
        company: true,
        companyName: true,
        parentCompany: true,
        creator: true,
        updatedAt: true,
        createdAt: true,
        notes: true,
        reported: true,
        checksum: true,
      },
      limit: 0,
      depth: 0,
    })

    const votesDetails = votesResult.docs || []

    // Get stock value data if available
    let stockValueData = null
    if (meeting.stockValue) {
      const stockValueId = meeting.stockValue
      try {
        stockValueData = await req.payload.findByID({
          collection: 'stock-values',
          id: stockValueId,
          depth: 0,
        })
      } catch (error) {
        console.error('Error fetching stock value:', error)
      }
    }

    // Build company data map from cache
    const meetingCompanyIds = (meeting.companies || []).map(getIdOfRelationField) as string[]
    const companyDataMap = getManyCompanyDataByIds(meetingCompanyIds)

    // Build passive funds map
    const passiveMap = new Map<string, boolean>()
    const meetingFundIds = (meeting.funds || []).map(getIdOfRelationField) as string[]
    const fundDataMap = getManyCompanyDataByIds(meetingFundIds)
    meetingFundIds.forEach((fundId) => {
      passiveMap.set(fundId, fundDataMap[fundId]?.passiveFund || false)
    })

    // Process voted companies
    const votedCompanies: VotedCompanyData[] = votesDetails.map((vote: any) => {
      let calculatedValues = {
        nominalValue: 0,
        percentageHolding: 0,
        holdingValueInMillions: 0,
      }

      let hasRelatedStock = false
      if (Array.isArray(meeting.fundsWithHolding)) {
        const companyHoldings = meeting.fundsWithHolding.filter(
          (holding: any) => holding.company === vote.company,
        )
        if (companyHoldings.length > 0) {
          const totalQuantity = companyHoldings.reduce((sum: number, holding: any) => {
            return sum + (holding.ownedQuantity || holding.quantity || 0)
          }, 0)
          calculatedValues = calculateHoldingValues(totalQuantity, stockValueData)
          hasRelatedStock = companyHoldings.some(
            (holding: any) => holding.fromRelatedStock === true,
          )
        }
      }

      const companyData = companyDataMap[vote.company]
      const parentCompanyId = companyData?.parentCompany || ''
      const parentData = parentCompanyId ? getCompanyDataById(parentCompanyId) : null
      const parentCompanyName = parentData?.name || vote.companyName

      // Check if all funds holding this company are passive
      const companyFunds =
        meeting.fundsWithHolding?.filter((holding: any) => holding.company === vote.company) || []
      const hasOnlyPassiveFunds =
        companyFunds.length > 0 &&
        companyFunds.every((holding: any) => passiveMap.get(holding.fund || '') === true)

      return {
        id: vote.company,
        name: vote.companyName,
        parentCompany: parentCompanyName,
        parentCompanyId,
        nominalValue: calculatedValues.nominalValue,
        percentageHolding: calculatedValues.percentageHolding,
        hasRelatedStock,
        passiveFunds: hasOnlyPassiveFunds,
        vote: {
          id: vote.id,
          voter:
            typeof vote.creator === 'string'
              ? vote.creator
              : vote.creator?.name || vote.creator?.email || 'Unknown',
          votedAt: vote.updatedAt || vote.createdAt || new Date().toISOString(),
          notes: vote.notes || '',
          reported: vote.reported || false,
          checksum: vote.checksum || '',
        },
      }
    })

    return new Response(JSON.stringify(votedCompanies), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching voted companies:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch voted companies' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Endpoint: GET /api/meetings/voting-data/not-voted-companies?meetingId=xxx
 * Fetches companies that have NOT voted for a specific meeting
 */
export async function getNotVotedCompaniesEndpoint(req: any) {
  try {
    const meetingId = req.query.meetingId as string

    if (!meetingId) {
      return new Response(JSON.stringify({ error: 'Meeting ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch the meeting document
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      select: {
        companies: true,
        funds: true,
        stockValue: true,
        fundsWithHolding: true,
      },
      depth: 0,
    })

    if (!meeting) {
      return new Response(JSON.stringify({ error: 'Meeting not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch votes for this meeting to get voted company IDs
    const votesResult = await req.payload.find({
      collection: 'votes',
      where: {
        meeting: { equals: meetingId },
      },
      select: { company: true },
      limit: 0,
      depth: 0,
    })

    const votedCompanyIds = new Set(votesResult.docs.map((vote: any) => vote.company))

    // Get stock value data if available
    let stockValueData = null
    if (meeting.stockValue) {
      const stockValueId = meeting.stockValue
      try {
        stockValueData = await req.payload.findByID({
          collection: 'stock-values',
          id: stockValueId,
          depth: 0,
        })
      } catch (error) {
        console.error('Error fetching stock value:', error)
      }
    }

    // Get all meeting companies
    const meetingCompanyIds = (meeting.companies || []).map(getIdOfRelationField) as string[]
    const notVotedIds = meetingCompanyIds.filter((id) => !votedCompanyIds.has(id))

    if (notVotedIds.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Use cache to get company data
    const companyDataMap = getManyCompanyDataByIds(notVotedIds)

    // Build passive funds map from cache
    const passiveMap = new Map<string, boolean>()
    const meetingFundIds = (meeting.funds || []).map(getIdOfRelationField) as string[]
    const fundDataMap = getManyCompanyDataByIds(meetingFundIds)
    meetingFundIds.forEach((fundId) => {
      passiveMap.set(fundId, fundDataMap[fundId]?.passiveFund || false)
    })

    // Process not voted companies
    const notVotedCompanies: NotVotedCompanyData[] = notVotedIds
      .map((companyId) => {
        const companyData = companyDataMap[companyId]
        if (!companyData) {
          console.warn(`No company data found for company ID: ${companyId}`)
          return null
        }

        let calculatedValues = {
          nominalValue: 0,
          percentageHolding: 0,
          holdingValueInMillions: 0,
        }

        let hasRelatedStock = false
        if (Array.isArray(meeting.fundsWithHolding)) {
          const companyHoldings = meeting.fundsWithHolding.filter(
            (holding: any) => holding.company === companyId,
          )
          if (companyHoldings.length > 0) {
            const totalQuantity = companyHoldings.reduce((sum: number, holding: any) => {
              return sum + (holding.ownedQuantity || holding.quantity || 0)
            }, 0)
            calculatedValues = calculateHoldingValues(totalQuantity, stockValueData)
            hasRelatedStock = companyHoldings.some(
              (holding: any) => holding.fromRelatedStock === true,
            )
          }
        }

        const parentCompanyId = companyData.parentCompany || ''
        const parentData = parentCompanyId ? getCompanyDataById(parentCompanyId) : null
        const parentCompanyName = parentData?.name || companyData.name

        // Check if all funds holding this company are passive
        const companyFunds =
          meeting.fundsWithHolding?.filter((holding: any) => holding.company === companyId) || []
        const hasOnlyPassiveFunds =
          companyFunds.length > 0 &&
          companyFunds.every((holding: any) => passiveMap.get(holding.fund || '') === true)

        return {
          id: companyId,
          name: companyData.name,
          parentCompany: parentCompanyName,
          parentCompanyId: parentCompanyId,
          nominalValue: calculatedValues.nominalValue,
          percentageHolding: calculatedValues.percentageHolding,
          hasRelatedStock,
          passiveFunds: hasOnlyPassiveFunds,
        }
      })
      .filter((company): company is NotVotedCompanyData => company !== null)

    return new Response(JSON.stringify(notVotedCompanies), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching not voted companies:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch not voted companies' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
/**
 * Endpoint: GET /api/meetings/voting-data/companies-order?meetingId=xxx
 * Fetches companies order map
 */
export async function getCompaniesOrderEndpoint(req: any) {
  try {
    // Get the companies order map
    const companyOrderMap = getCompanyOrderMap() || new Map<string, string>()
    return new Response(JSON.stringify(Array.from(companyOrderMap.entries())), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching companies order:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch companies order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Endpoint: GET /api/meetings/voting-data/historical-holdings?meetingId=xxx
 * Fetches historical holdings (companies that held 30 days before but not invited)
 */
export async function getHistoricalHoldingsEndpoint(req: any) {
  try {
    const meetingId = req.query.meetingId as string

    if (!meetingId) {
      return new Response(JSON.stringify({ error: 'Meeting ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch the meeting document
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      depth: 0,
    })

    if (!meeting) {
      return new Response(JSON.stringify({ error: 'Meeting not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const raw = meeting.historicalHoldings
    const historicalHoldingsData = Array.isArray(raw) ? raw : []

    if (!historicalHoldingsData || historicalHoldingsData.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get unique company IDs and fund IDs from historical holdings
    const historicalCompanyIds = [
      ...new Set(historicalHoldingsData.map((h) => h.company)),
    ] as string[]
    const historicalFundIds = [...new Set(historicalHoldingsData.map((h) => h.fund))] as string[]

    // Get all IDs and fetch from cache
    const allIds = [...new Set([...historicalCompanyIds, ...historicalFundIds])]
    const companyDataMap = getManyCompanyDataByIds(allIds)

    // Group historical holdings by company and aggregate quantities
    const groupedByCompany = new Map<
      string,
      {
        lastDate: string
        totalQuantity: number
        fundDetails: Map<string, { fundName: string; quantity: number; lastHoldingDate: string }>
      }
    >()

    historicalHoldingsData.forEach((holding: any) => {
      const companyId = holding.company
      const fundId = holding.fund

      if (!companyId || !fundId) return

      const existing = groupedByCompany.get(companyId)
      const holdingDate = holding.lastHoldingDate || ''
      const quantity = holding.quantity || 0
      const fundData = companyDataMap[fundId]
      const fundName = fundData?.name || fundId

      if (!existing) {
        const fundDetailsMap = new Map<
          string,
          { fundName: string; quantity: number; lastHoldingDate: string }
        >()
        fundDetailsMap.set(fundId, {
          fundName,
          quantity,
          lastHoldingDate: holdingDate,
        })
        groupedByCompany.set(companyId, {
          lastDate: holdingDate,
          totalQuantity: quantity,
          fundDetails: fundDetailsMap,
        })
      } else {
        if (new Date(holdingDate) > new Date(existing.lastDate)) {
          existing.lastDate = holdingDate
        }
        existing.totalQuantity += quantity
        const existingFund = existing.fundDetails.get(fundId)
        if (existingFund) {
          existingFund.quantity += quantity
          if (new Date(holdingDate) > new Date(existingFund.lastHoldingDate)) {
            existingFund.lastHoldingDate = holdingDate
          }
        } else {
          existing.fundDetails.set(fundId, {
            fundName,
            quantity,
            lastHoldingDate: holdingDate,
          })
        }
      }
    })

    // Create historical holdings array
    const processedHistoricalHoldings: HistoricalHoldingData[] = Array.from(
      groupedByCompany.entries(),
    ).map(([companyId, holdingData]) => {
      const companyData = companyDataMap[companyId]
      const companyName = companyData?.name || companyId

      return {
        id: companyId,
        companyId,
        companyName,
        lastHoldingDate: holdingData.lastDate,
        quantity: holdingData.totalQuantity,
        fundDetails: Array.from(holdingData.fundDetails.entries()).map(([fundId, fundData]) => ({
          fundId,
          fundName: fundData.fundName,
          quantity: fundData.quantity,
          lastHoldingDate: fundData.lastHoldingDate,
        })),
      }
    })

    return new Response(JSON.stringify(processedHistoricalHoldings), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching historical holdings:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch historical holdings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
