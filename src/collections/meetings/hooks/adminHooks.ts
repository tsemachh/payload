import {
  type CollectionBeforeChangeHook,
  SelectFieldSingleValidation,
  TextFieldSingleValidation,
} from 'payload'

export const beforeChangeMeetingId: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation == 'create') {
    if (!data.meetingId) {
      data.meetingId = `${Math.floor(Math.random() * 1000000)}`
    }
  }
  return data
}

export const validateMeetingInvitationLink: TextFieldSingleValidation = (
  value: string | null | undefined,
  options: any,
) => {
  if (options.req.context.from == 'migration' || options.req.context.from == 'process') {
    return true
  }
  if (options.siblingData.magnaId || options.siblingData.invitationDocument || value) return true
  return 'יש להזין קישור לזימון, אסמכתא או מסמך זימון'
}
export const validateMeetingState: SelectFieldSingleValidation = (
  value: string | null | undefined,
  options: any,
) => {
  if (!value) return true

  if (options.req.context.from == 'migration' || options.req.context.from == 'process') {
    return true
  }
  const { siblingData } = options
  const currentDate = new Date()
  const meetingDate = siblingData.meetingDate ? new Date(siblingData.meetingDate) : null
  if (value == 'on-hold' && !meetingDate) return true

  if (!meetingDate) {
    return 'יש לספק מועד אסיפה'
  }
  if (meetingDate) {
    switch (value) {
      case 'completed':
        if (meetingDate > currentDate) {
          return 'מצב ״התקיימה״ מתאפשר רק לאסיפות שמועדן בעבר'
        }
        break

      case 'postponed':
        if (meetingDate < currentDate) {
          return 'מצב ״נדחית״ מתאפשר רק לאסיפות שמועדן בעתיד'
        }
        break

      case 'scheduled':
        if (meetingDate < currentDate) {
          return 'מצב ״מתוכננת״ מתאפשר רק לאסיפות שמועדן בעתיד'
        }
        break

      case 'ongoing':
        if (meetingDate < currentDate) {
          return 'מצב ״נמשכת״ מתאפשר רק לאסיפות שמועדן בעתיד'
        }
        break
    }
    return true
  }
  // Ensure we always return a valid value
  return true
}
