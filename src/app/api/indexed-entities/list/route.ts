import { NextResponse } from "next/server";

type EntityType = "workflow" | "agent" | "voice_agent" | "automation";

type IndexedEntity = {
  id: string;
  name: string;
  platform: string;
  type: EntityType;
  last_seen_at: string;
  created_at: string;
  created_at_ts: number;
  last_updated_ts: number;
  last_updated_at: string;
  indexed: boolean;
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function formatRelative(d: Date) {
  const deltaMs = Date.now() - d.getTime();
  const min = Math.floor(deltaMs / 60000);
  if (min < 60) return `${Math.max(min, 1)} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} days ago`;
  const wk = Math.floor(day / 7);
  return `${wk} week${wk === 1 ? "" : "s"} ago`;
}

export async function GET() {
  // Temporary server-backed stub so UI is fully wired.
  // Replace this with your real DB query later.
  const now = Date.now();

  const rows: IndexedEntity[] = [
    {
      id: "1",
      name: "Customer Support Workflow",
      platform: "n8n",
      type: "workflow",
      created_at_ts: now - 7 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 2 * 60 * 60 * 1000,
      indexed: true,
    },
    {
      id: "2",
      name: "Sales Lead Bot",
      platform: "Make",
      type: "agent",
      created_at_ts: now - 8 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 5 * 60 * 60 * 1000,
      indexed: true,
    },
    {
      id: "3",
      name: "Voice Assistant",
      platform: "Vapi",
      type: "voice_agent",
      created_at_ts: now - 10 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 24 * 60 * 60 * 1000,
      indexed: true,
    },
    {
      id: "4",
      name: "Data Processing Pipeline",
      platform: "Activepieces",
      type: "automation",
      created_at_ts: now - 13 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 3 * 24 * 60 * 60 * 1000,
      indexed: true,
    },
    {
      id: "5",
      name: "Retell Integration",
      platform: "Retell",
      type: "workflow",
      created_at_ts: now - 17 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 7 * 24 * 60 * 60 * 1000,
      indexed: true,
    },
  ].map((r) => {
    const created = new Date(r.created_at_ts);
    const updated = new Date(r.last_updated_ts);
    return {
      ...r,
      created_at: formatDate(created),
      last_updated_at: formatDate(updated),
      last_seen_at: formatRelative(updated),
    };
  });

  return NextResponse.json({ ok: true, entities: rows });
}
