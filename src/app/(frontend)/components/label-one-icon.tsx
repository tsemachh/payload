import { colorClasses } from '../helpers/maps'

interface LabelIconProps {
  id: string
  label: string
  color: string
}

export function LabelIcon({ id, label, color }: LabelIconProps) {
  if (!label) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  return (
    <div
      key={id}
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${
        colorClasses[color] || 'bg-gray-500'
      }`}
    >
      {label}
    </div>
  )
}
