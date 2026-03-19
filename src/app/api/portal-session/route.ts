import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/portal-session
 *
 * Called from the client dashboard after successful payment redirect.
 * Sets a portal_session_{portalId} cookie so returning subscribers
 * are recognized on the subscribe page without needing the magic link.
 *
 * Body: { portalId: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { portalId, email } = body as {
      portalId?: string;
      email?: string;
    };

    if (!portalId || !email) {
      return NextResponse.json(
        { error: 'portalId and email are required' },
        { status: 400 }
      );
    }

    // Verify this email actually has an active subscription for this portal
    const { data: customer } = await supabaseAdmin
      .from('portal_customers')
      .select('subscription_status')
      .eq('portal_id', portalId)
      .eq('email', email)
      .eq('subscription_status', 'active')
      .maybeSingle();

    if (!customer) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 403 }
      );
    }

    // Look up the portal token for the cookie value
    const { data: portal } = await supabaseAdmin
      .from('client_portals')
      .select('token')
      .eq('id', portalId)
      .maybeSingle();

    if (!portal?.token) {
      return NextResponse.json(
        { error: 'Portal not found' },
        { status: 404 }
      );
    }

    // Set cookies scoped to this portal
    // Expires in 90 days (aligns with typical subscription billing cycles)
    const response = NextResponse.json({ ok: true });

    response.cookies.set(`portal_session_${portalId}`, portal.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
    });

    response.cookies.set(`portal_email_${portalId}`, email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('[portal-session] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
