import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withApiHandler } from "@/lib/api/withApiHandler";

export const POST = withApiHandler(async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  await supabase.rpc('increment_view_count', { p_offering_id: id });
  return NextResponse.json({ ok: true });
});