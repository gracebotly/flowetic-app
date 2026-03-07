'use client';

import { type EntityHealth } from './panels/shared/HealthBanner';
import { RetellDetailPanel } from './panels/RetellDetailPanel';
import { VapiDetailPanel } from './panels/VapiDetailPanel';
import { MakeDetailPanel } from './panels/MakeDetailPanel';
import { N8nDetailPanel } from './panels/N8nDetailPanel';

interface EntityDetailsPanelProps {
  platform: string;
  sourceId: string;
  externalId: string;
  onHealthChange?: (health: EntityHealth) => void;
}

export function EntityDetailsPanel({ platform, sourceId, externalId, onHealthChange }: EntityDetailsPanelProps) {
  if (platform === 'retell') {
    return <RetellDetailPanel platform="retell" sourceId={sourceId} externalId={externalId} onHealthChange={onHealthChange} />;
  }
  if (platform === 'vapi') {
    return <VapiDetailPanel platform="vapi" sourceId={sourceId} externalId={externalId} onHealthChange={onHealthChange} />;
  }
  if (platform === 'make') {
    return <MakeDetailPanel sourceId={sourceId} externalId={externalId} onHealthChange={onHealthChange} />;
  }
  if (platform === 'n8n') {
    return <N8nDetailPanel sourceId={sourceId} externalId={externalId} onHealthChange={onHealthChange} />;
  }

  return (
    <div className="py-8 text-center">
      <div className="text-sm text-gray-400">Platform &quot;{platform}&quot; is not yet supported in the detail view.</div>
    </div>
  );
}
