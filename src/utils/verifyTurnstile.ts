/**
 * Utility function to verify a Cloudflare Turnstile token on the server side
 */

export async function verifyTurnstile(token: string): Promise<{
  success: boolean;
  errorCodes?: string[];
}> {
  if (!token) {
    return { success: false, errorCodes: ['missing-token'] };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not defined in environment variables');
    return { success: false, errorCodes: ['missing-secret-key'] };
  }

  try {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    
    if (!data.success) {
      console.log('Turnstile verification failed:', data['error-codes']);
    }
    
    return {
      success: data.success,
      errorCodes: data['error-codes'],
    };
  } catch (error) {
    console.error('Error verifying Turnstile token:', error);
    return { success: false, errorCodes: ['server-error'] };
  }
}