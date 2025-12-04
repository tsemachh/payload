import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import fs from 'fs'
import path from 'path'

/**
 * Endpoint to fetch all meetings where companies.length != votes.length
 * and generate a report file
 */
export const MeetingsVotesReportEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    const payload = req.payload

    // Get all meetings
    const meetings = await payload.find({
      collection: 'meetings',
      select: {
        fullName: true,
        primaryLegacyId: true,
        companies: true,
        votes: true,
      },
      limit: 0, // Get all meetings
      depth: 0,
    })

    // Filter meetings where companies.length != fundsWithHolding.length
    const mismatchedMeetings = meetings.docs.filter((meeting) => {
      const companiesLength = meeting.companies?.length || 0
      const votesLength = meeting.votes?.docs?.length || 0
      return companiesLength !== votesLength
    })

    // Create report data
    const reportData = mismatchedMeetings.map((meeting) => ({
      meetingName: meeting.fullName || 'Unknown',
      primaryLegacyId: meeting.primaryLegacyId || 'Unknown',
      companiesCount: meeting.companies?.length || 0,
      votesCount: meeting.votes?.docs?.length || 0,
    }))

    // Generate CSV content
    let csvContent = 'Meeting Name,Meeting ID,# Companies,# votes\n'
    reportData.forEach((row) => {
      csvContent += `"${row.meetingName}",${row.primaryLegacyId},${row.companiesCount},${row.votesCount}\n`
    })

    // Write to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = path.resolve(process.cwd(), `meetings-votes-report-${timestamp}.csv`)
    fs.writeFileSync(filePath, csvContent, 'utf8')

    // Return success response
    return Response.json({
      success: true,
      message: `Report generated successfully with ${reportData.length} meetings`,
      filePath,
      data: reportData,
    })
  } catch (error) {
    req.payload.logger.error(`Error in meetingsVotesReportEndpoint: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        message: 'Failed to generate meetings votes report',
        error: JSON.stringify(error),
      },
      { status: 500 },
    )
  }
}

export default MeetingsVotesReportEndpoint
