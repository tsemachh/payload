import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface LabelsIconProps {
  row: {
    labels?: Array<{
      id: string
      label: string
      color: string
    }>
  }
}

const colorClasses: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  teal: 'bg-teal-500',
  gray: 'bg-gray-500',
  black: 'bg-black',
}

export function LabelsIcon({ row }: LabelsIconProps) {
  if (!row.labels || row.labels.length === 0) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  const firstLabel = row.labels[0]
  const remainingCount = row.labels.length - 1

  return (
    <TooltipProvider>
      <div className="flex items-center justify-end " dir="ltr">
        <div
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white max-w-[80px] ${colorClasses[firstLabel.color] || 'bg-gray-500'}`}
          title={firstLabel.label}
        >
          <span className="truncate">{firstLabel.label}</span>
        </div>

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help hover:text-foreground transition-colors font-medium">
                +{remainingCount}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <div className="text-xs font-medium mb-2">כל התגיות:</div>
                <div className="flex flex-wrap gap-1">
                  {row.labels.map((label) => (
                    <div
                      key={label.id}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${colorClasses[label.color] || 'bg-gray-500'}`}
                    >
                      {label.label}
                    </div>
                  ))}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
