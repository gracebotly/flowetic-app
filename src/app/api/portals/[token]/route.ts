import { NextRequest, NextResponse } from 'next/server';
import { resolvePortal } from '@/lib/portals/resolvePortal';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return NextResponse.json(
      { error: 'Invalid portal token' },
      { status: 400 }
    );
  }

  const result = await resolvePortal(token);

  if (!result) {
    return NextResponse.json(
      { error: 'Portal not found or expired' },
      { status: 404 }
    );
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
