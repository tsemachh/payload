import { verifyTurnstile } from '@/utils/verifyTurnstile';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, idempotencyKey } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'נדרש טוקן' },
        { status: 400 }
      );
    }

    // Verify the Turnstile token
    const result = await verifyTurnstile(token);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'אימות Turnstile נכשל',
          errorCodes: result.errorCodes 
        },
        { status: 400 }
      );
    }

    // If we have an idempotency key, we could store it in a cache/DB to prevent replay attacks
    // For example: await redis.set(`turnstile:${idempotencyKey}`, 'verified', 'EX', 300);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('שגיאה באימות טוקן Turnstile:', error);
    return NextResponse.json(
      { success: false, error: 'שגיאת שרת' },
      { status: 500 }
    );
  }
}
