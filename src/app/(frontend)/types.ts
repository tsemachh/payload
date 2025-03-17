import { MeetingState } from '@/payload-types'

export type MeetingTableDataType = {
  meetingId: string
  stockNumber: string //מספר נייר
  stockType: string //סוג נייר
  stockSymbol: string //סימול
  stockName: string //שם נייר
  companyName: string //שם החברה
  stockTradable: boolean //האם נסחר
  marketValue: number //שווי שוק
  registeredValue: number //ערך נקוב
  meetingType: string //סוג האסיפה
  meetingDate: string //מועד האסיפה
  reference: string
  meetingState: MeetingState | null
  location: string //מיקום
  holdingsLimit: string //תאריך קובע
  proxyVotingDate: string //מועד מסירת ההצבעה
  meetingInviteUrl: string //זימון אסיפה
  comments: string // - חוות דעת - הערות ??
  electronicVotingEnabled: boolean //האם האסיפה מופיעה במערכת האלקטרונית?
  resultsConfirmationStatus: boolean //אימות תוצאות האסיפה
  committeeInitiated: boolean //האם פיננסי דורש ועדה?
}

export type DateFilterOption = {
  value: string
  label: string
}
