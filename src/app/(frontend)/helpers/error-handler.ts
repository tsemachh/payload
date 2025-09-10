import { toast } from '@/hooks/use-toast';

export interface ErrorDetails {
  message: string;
  code?: string;
  details?: any;
}

export const handleApiError = (error: any, fallbackMessage: string, logDetails = true): ErrorDetails => {
  // Extract error message
  const errorMessage = error?.message || 
                      error?.error || 
                      (typeof error === 'string' ? error : fallbackMessage);
  
  // Log detailed error information to console
  if (logDetails) {
    console.error('API Error:', {
      message: errorMessage,
      originalError: error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      // Add any additional context that might be helpful
      url: typeof window !== 'undefined' ? window.location.href : null,
    });
  }
  
  // Return structured error details
  return {
    message: errorMessage,
    code: error?.code || error?.status,
    details: error
  };
};

export const notifyError = (errorDetails: ErrorDetails, duration = 3000) => {
  toast({
    title: '⚠️ שגיאה',
    description: errorDetails.message,
    variant: 'destructive',
    duration: duration,
  });
};

// Combined function for common use case
export const handleAndNotifyError = (error: any, fallbackMessage: string) => {
  const errorDetails = handleApiError(error, fallbackMessage);
  notifyError(errorDetails);
  return errorDetails;
};