// Create arrays from the types
export const stockTypeOptions: { label: string; value: string }[] = [
  { label: 'מניות', value: 'מניות' },
  { label: 'אופציות', value: 'אופציות' },
  { label: 'איגרות חוב', value: 'איגרות חוב' },
  { label: 'איגרות חוב להמרה', value: 'איגרות חוב להמרה' },
  { label: 'יחידת השתתפות', value: 'יחידת השתתפות' },
  { label: 'תעודות מדד', value: 'תעודות מדד' },
  { label: 'תעודות סל', value: 'תעודות סל' },
  { label: 'קרנות נאמנות', value: 'קרנות נאמנות' },
  { label: 'נייר ערך מסחרי', value: 'נייר ערך מסחרי' },
  { label: 'אחר', value: 'אחר' },
  { label: 'זכויות', value: 'זכויות' },
  { label: 'מק"מ', value: 'מק"מ' },
  { label: 'שטרי הון', value: 'שטרי הון' },
]

export const meetingTypeOptions: { label: string; value: string }[] = [
  { label: 'שנתית', value: 'שנתית' },
  { label: 'מיוחדת', value: 'מיוחדת' },
  { label: 'אג"ח', value: 'אג"ח' },
  { label: 'אופציה', value: 'אופציה' },
  { label: 'יחידת השתתפות', value: 'יחידת השתתפות' },
  { label: 'תעודת סל', value: 'תעודת סל' },
  { label: 'אג"ח כהונת נאמן', value: 'אג"ח כהונת נאמן' },
]

export const meetingStateOptions: { label: string; value: string }[] = [
  { label: 'מתוכננת', value: 'scheduled' },
  { label: 'התקיימה', value: 'completed' },
  { label: 'נדחית', value: 'postponed' },
  { label: 'נדחית ללא מועד', value: 'on-hold' },
  { label: 'נמשכת', value: 'ongoing' },
  { label: 'בוטלה', value: 'cancelled' },
]