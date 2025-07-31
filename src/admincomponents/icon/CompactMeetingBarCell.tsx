'use client'

import CompactMeetingBar from './CompactMeetingBar'

const CompactMeetingBarCell = ({ cellData }: { cellData: any }) => {
  if (!cellData) {
    return <div className="text-gray-400">-</div>
  }

  try {
    const data = JSON.parse(cellData as string)
    return (
      <CompactMeetingBar
        companies={data.companies}
        votes={data.votes}
        reportedVotes={data.reportedVotes}
      />
    )
  } catch (error) {
    console.error('Error parsing participation data:', error)
    return <div className="text-red-400">Error</div>
  }
}

export default CompactMeetingBarCell
