import { handleApiError, notifyError, ErrorDetails } from './error-handler';
import { logApiCall } from '../lib/api-logger';

interface FetchOptions extends RequestInit {
  notifyOnError?: boolean;
  errorMessage?: string;
}

export async function fetchWithErrorHandling<T = any>(
  url: string, 
  options?: FetchOptions
): Promise<T> {
  const { 
    notifyOnError = true, 
    errorMessage = 'שגיאה בביצוע הפעולה', 
    ...fetchOptions 
  } = options || {};
  
  const startTime = Date.now();
  const method = fetchOptions.method || 'GET';
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // Log successful API call
    logApiCall(method, url, startTime, response, undefined, fetchOptions.headers as any);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { status: response.status, statusText: response.statusText };
      }
      
      const error = {
        ...errorData,
        status: response.status,
        statusText: response.statusText,
      };
      
      // Log API error
      logApiCall(method, url, startTime, response, error, fetchOptions.headers as any);
      
      throw error;
    }
    
    return await response.json();
  } catch (error) {
    // Log API error for network/other errors
    logApiCall(method, url, startTime, undefined, error, fetchOptions.headers as any);
    
    const errorDetails = handleApiError(error, errorMessage);
    
    if (notifyOnError) {
      notifyError(errorDetails);
    }
    
    throw errorDetails;
  }
}

// Specialized versions for common HTTP methods
export const getWithErrorHandling = <T = any>(url: string, options?: FetchOptions) => 
  fetchWithErrorHandling<T>(url, { method: 'GET', ...options });

export const postWithErrorHandling = <T = any>(url: string, data: any, options?: FetchOptions) => 
  fetchWithErrorHandling<T>(url, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...options 
  });