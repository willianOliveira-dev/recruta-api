export const OUTBOX_AI_ROUTED_EVENT_TYPES = new Set([
  'candidate.created',
  'candidate.updated',
  'candidate.resume.updated',
  'candidate.skills.updated',
  'candidate.experiences.updated',
  'job.published',
  'job.updated',
  'job.skills.updated',
  'application.created',
  'application.stage.changed',
  'interview_note.ai_context_added',
]);

export interface OutboxEventEnvelope {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  organizationId: string | null;
  actorUserId: string | null;
  correlationId: string | null;
  entity: {
    type: string;
    id: string;
  };
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface OutboxPublishRoute {
  exchange: string;
  routingKey: string;
}
