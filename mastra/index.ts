import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';
import { vibeRouterAgent } from '@/lib/copilotkit/vibe-router-agent';

// Create Postgres storage
const mastraStorage = new PostgresStore({
  id: 'flowetic-pg',
  connectionString: process.env.DATABASE_URL!,
});

export const mastra = new Mastra({
  storage: mastraStorage,
  agents: {
    vibeRouterAgent,
  },
});
