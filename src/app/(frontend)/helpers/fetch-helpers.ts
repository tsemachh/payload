import { handleApiError, notifyError, ErrorDetails } from './error-handler';

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
  
  try {
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { status: response.status, statusText: response.statusText };
      }
      
      throw {
        ...errorData,
        status: response.status,
        statusText: response.statusText,
      };
    }
    
    return await response.json();
  } catch (error) {
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