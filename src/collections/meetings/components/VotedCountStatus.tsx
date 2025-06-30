import LoadingSpinnerDiamond from '@/app/(frontend)/components/ui/loading-spinner-diamond'

const ProgressCircle = ({ percentage }: { percentage: number }) => {
  const radius = 12
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} stroke="#e5e7eb" strokeWidth="3" fill="none" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke={'#10b981'}
          strokeWidth="3"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
    </div>
  )
}

interface VotedCountStatusProps {
  votingPercentage: number | null
  companiesNum: number
}

export default function VotedCountStatus({
  votingPercentage,
  companiesNum,
}: VotedCountStatusProps) {
  const getStatusText = () => {
    if (votingPercentage === 100) {
      return 'ההצבעות התקבלו בעמדה'
    } else if (votingPercentage && votingPercentage > 0) {
      return `התקבלו ${Math.round(companiesNum * votingPercentage) / 100}/${companiesNum} מההצבעות`
    } else {
      return 'ההצבעות טרם התקבלו בעמדה'
    }
  }

  return (
    <div className="flex items-center gap-2">
      {votingPercentage == null ? (
        <div className="flex flex-col h-[50px] items-center pt-10">
          <LoadingSpinnerDiamond />
        </div>
      ) : (
        <>
          <ProgressCircle percentage={votingPercentage} />
          <span className="font-medium text-sm px-2">{getStatusText()}</span>
        </>
      )}
    </div>
  )
}
