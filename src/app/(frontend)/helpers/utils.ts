export const formatDateTime = (originDate: string) => {
  if (!originDate) return '-'
  const date = new Date(originDate)
  if (isNaN(date.getTime())) return '-'
  const newDate = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem', // Force the correct timezone
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replaceAll('.', '/')
    .replace(', ', ' ')
  return newDate
}

