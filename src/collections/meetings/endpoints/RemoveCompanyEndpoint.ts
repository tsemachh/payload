import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { getIdOfRelationField } from '@/utils/utils'

/**
 * Endpoint to remove a company from a meeting
 * This will:
 * 1. Delete all votes for that company
 * 2. Remove company from companies array
 * 3. Remove related funds from fundsWithHolding array
 */
const removeCompanyEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const data = req.data as { meetingId?: string; companyId?: string } | undefined
    const { meetingId, companyId } = data || {}

    if (!meetingId || !companyId) {
      return Response.json(
        {
          success: false,
          message: 'Missing required fields: meetingId and companyId',
        },
        { status: 400 },
      )
    }

    // Get the meeting
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      depth: 0,
    })

    if (!meeting) {
      return Response.json(
        {
          success: false,
          message: 'Meeting not found',
        },
        { status: 404 },
      )
    }

    // Get the company to retrieve its name for logging
    const company = await req.payload.findByID({
      collection: 'companies',
      id: companyId,
      depth: 0,
    })

    // Find all votes for this company in this meeting
    const votes = await req.payload.find({
      collection: 'votes',
      where: {
        and: [{ meeting: { equals: meetingId } }, { company: { equals: companyId } }],
      },
      limit: 0,
    })

    // Delete all votes for this company
    if (votes.docs.length > 0) {
      await Promise.all(
        votes.docs.map((vote) =>
          req.payload.delete({
            collection: 'votes',
            id: vote.id,
            req,
          }),
        ),
      )
    }

    // Find all funds related to this company
    const fundsForCompany = await req.payload.find({
      collection: 'companies',
      where: {
        and: [{ type: { equals: 'fund' } }, { parentCompany: { equals: companyId } }],
      },
      limit: 0,
      depth: 0,
    })

    const fundIds = fundsForCompany.docs.map((fund) => fund.id)

    // Remove company from companies array
    const updatedCompanies = (meeting.companies || [])
      .map(getIdOfRelationField)
      .filter((id): id is string => typeof id === 'string' && id !== companyId)

    // Remove related funds from funds array
    const updatedFunds = (meeting.funds || [])
      .map(getIdOfRelationField)
      .filter((fundId): fundId is string => typeof fundId === 'string' && !fundIds.includes(fundId))

    // Remove related funds from fundsWithHolding array
    const updatedFundsWithHolding = (meeting.fundsWithHolding || []).filter((fwh: any) => {
      const fundId = getIdOfRelationField(fwh.fund)
      return typeof fundId === 'string' && !fundIds.includes(fundId)
    })

    // Update the meeting
    await req.payload.update({
      collection: 'meetings',
      id: meetingId,
      data: {
        companies: updatedCompanies as any,
        funds: updatedFunds as any,
        fundsWithHolding: updatedFundsWithHolding as any,
        changeDetails: `${new Date().toISOString()} - [user] הוסרה חברה: ${company?.name || companyId}`,
      },
      context: { from: 'process' },
      req,
    })

    return Response.json({
      success: true,
      message: `Company ${company?.name || companyId} removed successfully`,
      deletedVotes: votes.docs.length,
    })
  } catch (error) {
    req.payload.logger.error(`Error removing company from meeting: ${error}`)
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export default removeCompanyEndpoint
