"use client";

import { ScopedActivityFeed } from "@/components/activity/ScopedActivityFeed";

interface ActivityTabProps {
  clientId: string;
}

export function ActivityTab({ clientId }: ActivityTabProps) {
  return <ScopedActivityFeed clientId={clientId} limit={50} />;
}
