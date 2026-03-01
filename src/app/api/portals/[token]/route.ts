import { NextRequest, NextResponse } from 'next/server';
import { resolvePortal } from '@/lib/portals/resolvePortal';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const resolved = await resolvePortal(token);
  
  if (!resolved) {
    return NextResponse.json({ error: 'Portal not found or expired' }, { status: 404 });
  }

  return NextResponse.json(resolved, {
    headers: {
      // Cache for 30 seconds — client page will also use Realtime for live updates
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
