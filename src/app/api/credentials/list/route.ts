
import { NextResponse } from "next/server";

type ConnectMethod = "api" | "webhook" | "mcp";

type Credential = {
  id: string;
  platformType: string; // matches existing PLATFORM_META keys in your app (e.g. "n8n", "make", etc.)
  name: string; // display name (or connection name)
  method: ConnectMethod;
  status: "connected" | "attention" | "error";
  created_at_ts: number;
  last_updated_ts: number;
};

export async function GET() {
  const now = Date.now();

  // NOTE: This is a stub. Replace with DB later.
  const credentials: Credential[] = [
    {
      id: "cred_1",
      platformType: "n8n",
      name: "n8n",
      method: "api",
      status: "connected",
      created_at_ts: now - 2 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 2 * 60 * 60 * 1000,
    },
    {
      id: "cred_2",
      platformType: "make",
      name: "Make",
      method: "webhook",
      status: "connected",
      created_at_ts: now - 12 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 5 * 60 * 60 * 1000,
    },
    {
      id: "cred_3",
      platformType: "activepieces",
      name: "Activepieces",
      method: "mcp",
      status: "connected",
      created_at_ts: now - 20 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 24 * 60 * 60 * 1000,
    },
    {
      id: "cred_4",
      platformType: "vapi",
      name: "Vapi",
      method: "api",
      status: "connected",
      created_at_ts: now - 30 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 3 * 24 * 60 * 60 * 1000,
    },
    {
      id: "cred_5",
      platformType: "retell",
      name: "Retell",
      method: "api",
      status: "attention",
      created_at_ts: now - 45 * 24 * 60 * 60 * 1000,
      last_updated_ts: now - 7 * 24 * 60 * 60 * 1000,
    },
  ];

  return NextResponse.json({ ok: true, credentials });
}

