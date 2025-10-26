import { isWorkingDay } from '@/collections/meetings/hooks/calculateHoldingDate'

function atLocalMidnight(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Returns the [start,end) window covering the last working day before `now`.
 * - start: local midnight of the last working day
 * - end: local midnight of the day after `start`
 */
export function getLastWorkingDayWindow(now: Date = new Date()): { start: Date; end: Date } {
  // Step back to previous calendar day, then walk back until a working day
  const d = new Date(now)
  d.setDate(d.getDate() - 1)
  while (!isWorkingDay(d)) {
    d.setDate(d.getDate() - 1)
  }
  const start = atLocalMidnight(d)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}
