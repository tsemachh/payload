import { BasePayload, PayloadRequest } from 'payload';

/**
 * Filters email addresses based on allowed domains
 * @param emails - Array of email addresses or a single email address
 * @param allowedDomains - Array of allowed domains
 * @returns Filtered array of email addresses
 */
const filterEmailsByDomain = (
  emails: string | string[] | undefined,
  allowedDomains: string[]
): string[] => {
  if (!emails) return [];
  
  // Convert single email to array
  const emailArray = Array.isArray(emails) ? emails : [emails];
  
  // If allowedDomains includes '*', return all emails
  if (allowedDomains.includes('*')) {
    return emailArray;
  }
  
  // Filter emails by domain
  return emailArray.filter(email => {
    if (!email || typeof email !== 'string') return false;
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    
    return allowedDomains.some(allowedDomain => 
      domain === allowedDomain.toLowerCase() || 
      domain.endsWith(allowedDomain.toLowerCase())
    );
  });
};

/**
 * Gets allowed email domains from environment variables
 * @returns Array of allowed domains
 */
const getAllowedDomains = (): string[] => {
  const domainsString = process.env.ALLOWED_EMAIL_DOMAINS || '@shefing.com @emdaresearch.co.il';
  return domainsString.split(' ').map(domain => 
    domain.startsWith('@') ? domain.substring(1) : domain
  );
};

/**
 * Sends an email with filtered recipients based on allowed domains
 * @param payload - Payload instance
 * @param emailData - Email data including to, cc, bcc, subject, html, etc.
 * @returns Result from the original sendEmail function
 */
export const sendMail = async (
  payload: BasePayload,
  emailData: {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html: string;
    [key: string]: any;
  }
) => {
  const allowedDomains = getAllowedDomains();
  
  // Filter recipients by domain
  const filteredTo = filterEmailsByDomain(emailData.to, allowedDomains);
  const filteredCc = filterEmailsByDomain(emailData.cc, allowedDomains);
  const filteredBcc = filterEmailsByDomain(emailData.bcc, allowedDomains);
  
  // Create new email data with filtered recipients
  const filteredEmailData = {
    ...emailData,
    to: filteredTo.length > 0 ? filteredTo : undefined,
    cc: filteredCc.length > 0 ? filteredCc : undefined,
    bcc: filteredBcc.length > 0 ? filteredBcc : undefined,
  };
  
  // Log filtering results if there's a difference
  const originalCount = {
    to: Array.isArray(emailData.to) ? emailData.to.length : (emailData.to ? 1 : 0),
    cc: Array.isArray(emailData.cc) ? emailData.cc.length : (emailData.cc ? 1 : 0),
    bcc: Array.isArray(emailData.bcc) ? emailData.bcc.length : (emailData.bcc ? 1 : 0),
  };
  
  const filteredCount = {
    to: filteredTo.length,
    cc: filteredCc.length,
    bcc: filteredBcc.length,
  };
  
  if (
    originalCount.to !== filteredCount.to ||
    originalCount.cc !== filteredCount.cc ||
    originalCount.bcc !== filteredCount.bcc
  ) {
    payload.logger.info('Email recipients filtered by domain', {
      original: originalCount,
      filtered: filteredCount,
      allowedDomains,
    });
  }
  
  // If no recipients left after filtering, log and return
  if (!filteredEmailData.to && !filteredEmailData.cc && !filteredEmailData.bcc) {
    payload.logger.warn('No valid recipients left after domain filtering', {
      subject: emailData.subject,
      allowedDomains,
    });
    return { success: false, message: 'No valid recipients after domain filtering' };
  }
  
  // Send email with filtered recipients
  return await payload.sendEmail(filteredEmailData);
};

/**
 * Convenience function for sending email from a request context
 * @param req - Payload request
 * @param emailData - Email data including to, cc, bcc, subject, html, etc.
 * @returns Result from the sendMail function
 */
export const sendMailFromRequest = async (
  req: PayloadRequest,
  emailData: {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html: string;
    [key: string]: any;
  }
) => {
  return sendMail(req.payload, emailData);
};