// src/app/api/interfaces/[interfaceId]/versions/[versionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interfaceId: string; versionId: string }> }
) {
  const { interfaceId, versionId } = await params;

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = token
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
    : createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { data, error } = await supabase
      .from('interface_versions')
      .select('id, interface_id, spec_json, design_tokens, created_at')
      .eq('id', versionId)
      .eq('interface_id', interfaceId)
      .maybeSingle();

    if (error) {
      console.error('[GET /versions] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      console.warn('[GET /versions] No version found:', { interfaceId, versionId });
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /versions] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
