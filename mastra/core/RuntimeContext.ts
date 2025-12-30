




export interface RuntimeContext {
  tenantId: string;
  userId?: string;
  interfaceId: string;
  sourceId?: string;
  threadId?: string;
  runId?: string;
  platformType?: string;
  templateId?: string;
  mappings?: Record<string, string>;
}

// RuntimeContext builder
export function createRuntimeContext(params: Partial<RuntimeContext>): RuntimeContext {
  return {
    tenantId: params.tenantId || '',
    userId: params.userId,
    interfaceId: params.interfaceId || '',
    sourceId: params.sourceId,
    threadId: params.threadId,
    runId: params.runId,
    platformType: params.platformType,
    templateId: params.templateId,
    mappings: params.mappings,
  };
}

// RuntimeContext constructor class
export class RuntimeContext implements RuntimeContext {
  tenantId: string;
  userId?: string;
  interfaceId: string;
  sourceId?: string;
  threadId?: string;
  runId?: string;
  platformType?: string;
  templateId?: string;
  mappings?: Record<string, string>;

  constructor(params: Partial<RuntimeContext>) {
    this.tenantId = params.tenantId || '';
    this.userId = params.userId;
    this.interfaceId = params.interfaceId || '';
    this.sourceId = params.sourceId;
    this.threadId = params.threadId;
    this.runId = params.runId;
    this.platformType = params.platformType;
    this.templateId = params.templateId;
    this.mappings = params.mappings;
  }
}






