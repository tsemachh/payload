import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
    logtailToken: process.env.LOGTAIL_SOURCE_TOKEN,
    logtailEndpoint: process.env.LOGTAIL_ENDPOINT
  });
}
