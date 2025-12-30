// Import Mastra from the submodule in v0.19.  
import { Mastra } from '@mastra/core/mastra';
import { masterRouterAgent } from './agents/masterRouter';
import { platformMappingAgent } from './agents/platformMapping';
import { platformDetectionAgent } from './agents/platformDetectionAgent';
import { templateRecommendationAgent } from './agents/templateRecommendationAgent';
import { mappingGenerationAgent } from './agents/mappingGenerationAgent';
import { platformMappingMaster } from './agents/platformMappingMaster';
import { generatePreviewWorkflow } from './workflows/generatePreview';

export const mastra = new Mastra({
  agents: {
    masterRouter: masterRouterAgent,
    default: masterRouterAgent,
    platformMapping: platformMappingAgent,
  },
  workflows: {
    generatePreview: generatePreviewWorkflow,
  },
});
