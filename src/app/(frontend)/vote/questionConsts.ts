// constants/votingQuestions.ts (קובץ חדש)

import {
  AgendaExplanationKeys,
  AgendaQuestionId,
  GeneralExplanationKeys,
  GeneralQuestionId,
} from '../types/vote'

interface QuestionConfig {
  label: string
  explanationPlaceholder?: string
  requiresExplanation: boolean // האם כשתשובה "כן" דורשת הסבר
  toastNote: string
  toastNoteExplanation?: string
}

type GeneralQuestionsMap = {
  [key in GeneralQuestionId]: QuestionConfig
}

type AgendaQuestionsMap = {
  [key in AgendaQuestionId]: QuestionConfig
}

export const GENERAL_QUESTIONS_CONFIG: GeneralQuestionsMap = {
  [GeneralQuestionId.IS_INTERESTED]: {
    label: 'האם הינך בעל עניין?',
    explanationPlaceholder: 'נא לפרט את הסיבה...',
    requiresExplanation: true,
    toastNote: 'בעל עניין ',
    toastNoteExplanation: 'הסבר בעל עניין ',
  },
  [GeneralQuestionId.IS_SENIOR_OFFICIAL]: {
    label: 'האם הינך נושא משרה בכירה?',
    explanationPlaceholder: 'נא לפרט את הסיבה...',
    requiresExplanation: true,
    toastNote: ' נושא משרה בכירה ',
    toastNoteExplanation: 'הסבר נושא משרה בכירה ',
  },
  [GeneralQuestionId.IS_INSTITUTIONAL_INVESTOR]: {
    label: 'האם הינך משקיע מוסדי?',
    requiresExplanation: false, // לא דורש הסבר כשתשובה "כן"
    toastNote: 'משקיע מוסדי',
  },
}

export const AGENDA_QUESTIONS_CONFIG: AgendaQuestionsMap = {
  [AgendaQuestionId.HAS_CONFLICT_OF_INTEREST]: {
    label: 'ניגוד עניינים',
    explanationPlaceholder: 'נא לפרט...',
    requiresExplanation: true,
    toastNote: 'ניגוד עניינים',
    toastNoteExplanation: 'הסבר ניגוד עניינים',
  },
  [AgendaQuestionId.IS_RELATED_PARTY]: {
    label: 'צד קשור',
    explanationPlaceholder: 'נא לפרט...',
    requiresExplanation: true,
    toastNote: 'צד קשור',
    toastNoteExplanation: 'הסבר צד קשור',
  },
  [AgendaQuestionId.IS_INVESTMENT_COMMITTEE]: {
    label: 'ועדת השקעות',
    requiresExplanation: false, // לא דורש הסבר כשתשובה "כן"
    toastNote: 'ועדת השקעות',
  },
  [AgendaQuestionId.HAS_PERSONAL_INTEREST]: {
    label: 'עניין אישי',
    explanationPlaceholder: 'נא לפרט...',
    requiresExplanation: true,
    toastNote: 'עניין אישי',
    toastNoteExplanation: 'הסבר עניין אישי',
  },
}

// פונקציית עזר לשליפת שם שדה ההסבר
// נחזיר את הטיפוס הספציפי יותר, או מחרוזת ריקה
export function getExplanationFieldName(questionId: GeneralQuestionId): GeneralExplanationKeys | ''
export function getExplanationFieldName(questionId: AgendaQuestionId): AgendaExplanationKeys | ''
export function getExplanationFieldName(
  questionId: GeneralQuestionId | AgendaQuestionId,
): GeneralExplanationKeys | AgendaExplanationKeys | '' {
  switch (questionId) {
    case GeneralQuestionId.IS_INTERESTED:
      return 'interestedExplanation'
    case GeneralQuestionId.IS_SENIOR_OFFICIAL:
      return 'seniorOfficialExplanation'
    case AgendaQuestionId.HAS_CONFLICT_OF_INTEREST:
      return 'conflictOfInterestExplanation'
    case AgendaQuestionId.IS_RELATED_PARTY:
      return 'relatedPartyExplanation'
    case AgendaQuestionId.HAS_PERSONAL_INTEREST:
      return 'personalInterestExplanation'
    default:
      return ''
  }
}
