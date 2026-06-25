export interface AiUsageInput {
  promptTokens: number;
  completionTokens: number;
  embeddingTokens: number;
  cachedTokens: number;
  requestsCount: number;
}

export interface EmbeddingChunkInput {
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenCount: number | null;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface CompletedEmbeddingInput {
  organizationId: string;
  entityType: EmbeddingEntityType;
  entityId: string;
  source: string;
  sourceHash: string;
  embeddingModel: string;
  embeddingDimensions: number;
  metadata: Record<string, unknown>;
  chunks: EmbeddingChunkInput[];
  usage: AiUsageInput;
  processedAt: Date;
}

export interface CompletedMatchInput {
  organizationId: string;
  applicationId: string;
  aiScore: number;
  aiSummary: string | null;
  usage: AiUsageInput;
  processedAt: Date;
}

export interface FailedAiResultInput {
  organizationId: string;
  entityType: string;
  entityId: string;
  jobType: string;
  errorMessage: string;
  usage: AiUsageInput;
  processedAt: Date;
}

export type EmbeddingEntityType =
  | 'organization'
  | 'organization_profile'
  | 'job'
  | 'job_skill'
  | 'candidate'
  | 'candidate_skill'
  | 'candidate_experience'
  | 'application'
  | 'application_stage_history'
  | 'interview_note'
  | 'subscription_plan'
  | 'organization_subscription'
  | 'organization_ai_usage'
  | 'member'
  | 'invitation'
  | 'payment'
  | 'audit_log';
