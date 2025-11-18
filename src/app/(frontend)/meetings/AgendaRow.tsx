import { cn } from '@/lib/utils'
import React from 'react'

// Component for individual agenda item with tooltip
export const AgendaItem = ({ agenda, index }: { agenda: any; index: number }) => {
  const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.())
  const direction = isEnglish ? 'ltr' : 'rtl'
  const alignment = isEnglish ? 'text-left' : 'text-right'

  const [tooltipPosition, setTooltipPosition] = React.useState<{
    x: number
    y: number
    visible: boolean
  }>({ x: 0, y: 0, visible: false })

  const handleMouseMove = (e: React.MouseEvent) => {
    const tooltipWidth = 400
    const tooltipHeight = 100

    let x = e.clientX + 10 // 10px to the right of cursor
    let y = e.clientY - tooltipHeight - 10 // 10px above cursor

    // Check if tooltip goes off screen horizontally
    if (x + tooltipWidth > window.innerWidth) {
      x = e.clientX - tooltipWidth - 10 // Show to the left instead
    }

    // Check if tooltip goes off screen vertically
    if (y < 0) {
      y = e.clientY + 10 // Show below cursor instead
    }

    setTooltipPosition({ x, y, visible: true })
  }

  const handleMouseLeave = () => {
    setTooltipPosition((prev) => ({ ...prev, visible: false }))
  }

  return (
    <div className="relative">
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 cursor-help"
        style={{ maxWidth: 'calc(100vw - 150px)' }}
        onMouseMove={agenda.text && agenda.text.length > 30 ? handleMouseMove : undefined}
        onMouseLeave={handleMouseLeave}
      >
        {/* Index always on the right */}
        <span className="shrink-0 order-1">{index + 1}.</span>
        {/* Text content with proper direction */}
        <div
          dir={direction}
          className={cn('relative order-2 flex items-center gap-1', alignment)} // added flex & items-center & gap
          style={{ maxWidth: 'calc(100vw - 200px)', display: 'flex' }}
        >
          <span
            className={cn(
              'truncate', // always truncate if English
              !isEnglish && 'text-ellipsis overflow-hidden whitespace-nowrap',
            )}
            style={{
              maxWidth: 'calc(100vw - 200px)',
              ...(!isEnglish && {
                direction: 'rtl',
                textOverflow: 'ellipsis',
                unicodeBidi: 'plaintext',
              }),
              ...(agenda.isRemovedFromAgenda && {
                textDecoration: 'line-through',
                color: 'gray',
              }),
            }}
          >
            {agenda.text}
          </span>

          {agenda.isRemovedFromAgenda && (
            <span style={{ textDecoration: 'none', color: 'gray' }}>
              {isEnglish ? ' (Removed from agenda) ' : ' (הוסר מסדר היום) '}
            </span>
          )}
        </div>
      </div>

      {/* Dynamic positioned tooltip */}
      {agenda.text && agenda.text.length > 30 && tooltipPosition.visible && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg whitespace-normal break-words pointer-events-none transition-opacity duration-200"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            maxWidth: '400px',
            wordWrap: 'break-word',
            direction: direction,
            textAlign: isEnglish ? 'left' : 'right',
          }}
        >
          {agenda.text}
        </div>
      )}
    </div>
  )
}
