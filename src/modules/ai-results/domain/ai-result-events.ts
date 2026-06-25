export const AI_RESULT_EVENT_TYPES = {
  embeddingCompleted: 'ai.embedding.completed',
  embeddingFailed: 'ai.embedding.failed',
  matchCompleted: 'ai.match.completed',
  matchFailed: 'ai.match.failed',
  resumeParseCompleted: 'ai.resume_parse.completed',
  resumeParseFailed: 'ai.resume_parse.failed',
} as const;

export const AI_RESULT_EVENT_TYPE_VALUES = [
  AI_RESULT_EVENT_TYPES.embeddingCompleted,
  AI_RESULT_EVENT_TYPES.embeddingFailed,
  AI_RESULT_EVENT_TYPES.matchCompleted,
  AI_RESULT_EVENT_TYPES.matchFailed,
  AI_RESULT_EVENT_TYPES.resumeParseCompleted,
  AI_RESULT_EVENT_TYPES.resumeParseFailed,
] as const;

export type AiResultEventType = (typeof AI_RESULT_EVENT_TYPE_VALUES)[number];

export const AI_RESULT_SOURCE = 'python-ai-worker';

export const AI_JOB_TYPE_BY_RESULT_EVENT: Record<AiResultEventType, string> = {
  [AI_RESULT_EVENT_TYPES.embeddingCompleted]: 'embedding',
  [AI_RESULT_EVENT_TYPES.embeddingFailed]: 'embedding',
  [AI_RESULT_EVENT_TYPES.matchCompleted]: 'match',
  [AI_RESULT_EVENT_TYPES.matchFailed]: 'match',
  [AI_RESULT_EVENT_TYPES.resumeParseCompleted]: 'resume_parse',
  [AI_RESULT_EVENT_TYPES.resumeParseFailed]: 'resume_parse',
};
