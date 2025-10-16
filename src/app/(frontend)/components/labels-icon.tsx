import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { colorClasses } from '../helpers/maps'
import { LabelIcon } from './label-one-icon'

interface LabelsIconProps {
  row: {
    labels?: Array<{
      id: string
      label: string
      color: string
    }>
  }
}

export function LabelsIcon({ row }: LabelsIconProps) {
  if (!row.labels || row.labels.length === 0) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  const firstLabel = row.labels[0]
  const remainingCount = row.labels.length - 1

  return (
    <TooltipProvider>
      <div className="flex items-center justify-end" dir="ltr">
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help hover:text-foreground transition-colors font-medium mr-1">
                +{remainingCount}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <div className="text-xs font-medium mb-2">:כל התגיות</div>
                <div className="flex flex-wrap gap-1">
                  {row.labels.map((label) => (
                    <LabelIcon
                      key={label.id}
                      id={label.id}
                      label={label.label}
                      color={label.color}
                    />
                  ))}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        <div
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white max-w-[80px] ${
            colorClasses[firstLabel.color] || 'bg-gray-500'
          }`}
          title={firstLabel.label}
        >
          <span className="truncate">{firstLabel.label}</span>
        </div>
      </div>
    </TooltipProvider>
  )
}
