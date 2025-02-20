export type FutureMeetingTableData = {
  meetingId: number //TODO: change to string!
  // proofId:type? //אסמכתא
  stockNumber: string //מספר נייר
  stockType: string //סוג נייר
  companyName: string //שם החברה
  // marketValue: number //שווי שוק מיליוני
  meetingType: string //סוג האסיפה
  meetingDate: string //מועד האסיפה
  location: string //מיקום
  holdingsLimit: string //תאריך קובע
  proxyVotingDate: string //מועד מסירת ההצבעה
  // votingDocUrl: string //כתב הצבעה
  meetingInviteUrl: string //זימון אסיפה
  comments: string // - חוות דעת - הערות ??
  electronicVotingEnabled: boolean //האם האסיפה מופיעה במערכת האלקטרונית?
  resultsConfirmationStatus: boolean //אימות תוצאות האסיפה
  // relatedMeetingId: boolean //אסיפה קשורה ??
  committeeInitiated: boolean //האם פיננסי דורש ועדה?
  _status: StatusType //סטטוס
}

export enum StatusType {
  None = '',
  Draft = 'draft',
  Publish = 'publish',
}
