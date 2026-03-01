import { NextResponse } from 'next/server';

/**
 * DEPRECATED: Portal creation has moved to /api/offerings/create
 * This stub exists for backward compatibility during V4 transition.
 */
export async function POST(request: Request) {
  // Forward the body to the new endpoint
  const body = await request.json();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/offerings/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward auth cookies
      cookie: request.headers.get('cookie') || '',
    },
    body: JSON.stringify({
      ...body,
      // Map old field names to new
      surfaceType: 'analytics',
      accessType: 'magic_link',
    }),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
