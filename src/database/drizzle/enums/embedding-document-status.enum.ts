import { pgEnum } from 'drizzle-orm/pg-core';

export const embeddingDocumentStatusEnum = pgEnum('embedding_document_status', [
  'pending',
  'processing',
  'embedded',
  'stale',
  'failed',
]);
