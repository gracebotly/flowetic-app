
import { createClient } from '@/lib/supabase/server';

/**
 * Write a thread event to the Supabase `events` table.  The table must have a
 * JSON `payload` column and a `type` column.
 */
export async function logThreadEvent(
  threadId: string,
  type: 'tool_event' | 'state' | 'error',
  payload: Record<string, unknown>,
) {
  try {
    const supabase = createClient();
    await supabase.from('events').insert({
      thread_id: threadId,
      type,
      payload,
    });
  } catch (err) {
    // In case of logging failure, just print to console.  Do not interrupt the request.
    console.error('Error logging thread event', err);
  }
}

