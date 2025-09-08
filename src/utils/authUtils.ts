import { Access, FieldAccess, TypedUser, User } from 'payload'
import {
  Company,
  CompanyMeetingNotification,
  Holding,
  HoldingsFeed,
  Meeting,
  ResearchDocument,
  Vote,
} from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'

/**
 * Extract company IDs from a user's companies array
 */
const getUserCompanyIds = (user: User): string[] => {
  if (!user?.companies) return []

  return user.companies
    .map((company: any) =>
      typeof company.companyId === 'string' ? company.companyId : company.companyId?.id,
    )
    .filter(Boolean) as string[]
}

/**
 * Extract fund IDs from a user's funds array
 */
const getUserFundIds = (user: User): string[] => {
  if (!user?.funds) return []

  return user.funds.map(getIdOfRelationField).filter(Boolean)
}

/**
 * Check if a user has access to a company
 */
export const isUserCompany: Access<Company> = ({ req: { user, data } }) => {
  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  const company = data as Company
  if (!user || !company) return false

  // For fund type companies, check user's funds
  if (company.type === 'fund') {
    const userFundIds = getUserFundIds(user)
    return userFundIds.some((userFundId) => company.id === userFundId)
  }

  // For regular companies, check user's companies
  if (company.type === 'regular' || !company.type) {
    const userCompanyIds = getUserCompanyIds(user)
    return userCompanyIds.some((userCompanyId) => company.id === userCompanyId)
  }

  return false
}

/**
 * Check if a user has access to a holdings feed
 */
export const isUserCompanyHoldingFeed: Access<HoldingsFeed> = ({ req: { user, data } }) => {
  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  const holdingFeed = data as HoldingsFeed
  if (!user || !holdingFeed?.selectedCompanies) return false

  const holdingCompanyIds = holdingFeed.selectedCompanies.map(getIdOfRelationField).filter(Boolean)
  if (holdingCompanyIds.length === 0) return false

  const userCompanyIds = getUserCompanyIds(user)

  // Check if there is at least one common company ID
  return userCompanyIds.some((id) => holdingCompanyIds.includes(id))
}

/**
 * Check if a user has access to a holding
 */
export const isUserCompanyHolding: Access<Holding> = ({ req: { user, data } }) => {
  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  const holding = data as Holding
  if (!user || !holding?.fund) return false

  const holdingFundId = getIdOfRelationField(holding.fund)
  if (!holdingFundId) return false

  const userFundIds = getUserFundIds(user)
  return userFundIds.some((userFundId) => holdingFundId === userFundId)
}

const isUserHasWritePermission = (user: TypedUser): boolean => {
  return !!user?.companies?.some((company) => company.permission == 'write')
}
/**
 * Check if a user has write access to a holding
 */
export const isUserCompanyHoldingWrite: Access<Holding> = (params) => {
  const {
    req: { user, data },
  } = params

  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  // First check if user has read access
  if (!isUserCompanyHolding(params)) return false

  // Check if user has write permission for this fund
  return isUserHasWritePermission(user as TypedUser)
}

/**
 * Check if a user has access to a research document
 */
export const isUserCompanyResearchDoc: Access<ResearchDocument> = ({ req: { user, data } }) => {
  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  const doc = data as ResearchDocument
  if (!user || !doc?.companies) return false

  const docCompanyIds = doc.companies.map(getIdOfRelationField).filter(Boolean)
  if (docCompanyIds.length === 0) return false

  const userCompanyIds = getUserCompanyIds(user)

  // Check if there is at least one common company ID
  return userCompanyIds.some((id) => docCompanyIds.includes(id))
}

/**
 * Check if a user has write access to a research document
 */
export const isUserCompanyResearchDocWrite: Access<ResearchDocument> = (params) => {
  const {
    req: { user, data },
  } = params

  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  // First check if user has read access
  if (!isUserCompanyResearchDoc(params)) return false

  // Check if user has write permission for this fund
  return isUserHasWritePermission(user as TypedUser)
}

/**
 * Check if a user has access to a vote
 */
export const isUserCompanyVote: Access<Vote> = ({ req: { user, data } }) => {
  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  const vote = data as Vote
  if (!user || !vote?.company) return false

  const voteCompanyId = getIdOfRelationField(vote.company)
  if (!voteCompanyId) return false

  const userCompanyIds = getUserCompanyIds(user)
  return userCompanyIds.some((id) => id === voteCompanyId)
}

/**
 * Check if a user has write access to a vote
 */
export const isUserCompanyVoteWrite: Access<Vote> = (params) => {
  const {
    req: { user, data },
  } = params

  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  // First check if user has read access
  if (!isUserCompanyVote(params)) return false

  // Check if user has write permission for this fund
  return isUserHasWritePermission(user as TypedUser)
}

/**
 * Check if a user has access to a meeting
 */
export const isUserCompanyMeeting: Access<Meeting> = ({ req: { user, data } }) => {
  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  const meeting = data as Meeting
  if (!user || !meeting?.funds) return false

  const meetingFundIds = meeting.funds.map(getIdOfRelationField).filter(Boolean)
  if (meetingFundIds.length === 0) return false

  const userFundIds = getUserFundIds(user)

  // Check if there is at least one common fund ID
  return userFundIds.some((id) => meetingFundIds.includes(id))
}

/**
 * Check if a user has write access to a meeting
 */
export const isUserCompanyMeetingWrite: Access<Meeting> = (params) => {
  const {
    req: { user, data },
  } = params

  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  // First check if user has read access
  if (!isUserCompanyMeeting(params)) return false

  // Check if user has write permission for this fund
  return isUserHasWritePermission(user as TypedUser)
}

/**
 * Check if a user has access to a notification
 */
export const isUserCompanyNotification: Access<CompanyMeetingNotification> = ({
  req: { user, data },
}) => {
  // If Admin or data is null (list request), allow access
  if (user?.isAdmin || (user && !data)) return true

  const notification = data as CompanyMeetingNotification
  if (!user || !notification?.company) return false

  const notificationCompanyId = getIdOfRelationField(notification.company)
  if (!notificationCompanyId) return false

  const userCompanyIds = getUserCompanyIds(user)

  // Check if the user has access to the notification's company
  return userCompanyIds.some((id) => id === notificationCompanyId)
}

/**
 * Check if the user is an admin
 */
export const isAdmin: Access<any> = ({ req: { user } }) => {
  return Boolean(user?.isAdmin)
}

/**
 * Field-level access control for admin-only fields
 */
export const isAdminFieldLevel: FieldAccess<{ id: string }, User> = ({ req: { user } }) => {
  return Boolean(user?.isAdmin)
}

/**
 * Check if the user is an admin or accessing their own record
 */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false

  if (user.isAdmin) return true

  // If any other type of user, only provide access to themselves
  return {
    id: {
      equals: user.id,
    },
  }
}

/**
 * Check if the user is logged in
 */
export const isLoggedIn: Access<any> = ({ req: { user } }) => {
  return Boolean(user)
}
