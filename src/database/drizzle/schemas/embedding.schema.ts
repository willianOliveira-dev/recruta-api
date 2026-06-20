import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { embeddingDocumentStatusEnum } from '../enums/embedding-document-status.enum';
import { embeddingEntityTypeEnum } from '../enums/embedding-entity-type.enum';
import {
  EMBEDDING_DIMENSIONS,
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { organization } from './auth.schema';

type EmbeddingMetadata = Record<string, unknown>;

export const embeddingDocument = pgTable(
  'embedding_document',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'cascade',
    }),
    entityType: embeddingEntityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    source: text('source').notNull(),
    sourceHash: text('source_hash').notNull(),
    embeddingModel: text('embedding_model').notNull(),
    embeddingDimensions: integer('embedding_dimensions')
      .default(EMBEDDING_DIMENSIONS)
      .notNull(),
    status: embeddingDocumentStatusEnum('status').default('pending').notNull(),
    metadata: jsonb('metadata')
      .$type<EmbeddingMetadata>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    lastEmbeddedAt: timestampUtc('last_embedded_at'),
    errorMessage: text('error_message'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('embedding_document_organization_id_idx').on(table.organizationId),
    index('embedding_document_entity_idx').on(table.entityType, table.entityId),
    index('embedding_document_status_idx').on(table.status),
    uniqueIndex('embedding_document_source_uidx').on(
      table.entityType,
      table.entityId,
      table.source,
      table.embeddingModel,
      table.sourceHash,
    ),
  ],
);

export const embeddingChunk = pgTable(
  'embedding_chunk',
  {
    id: uuidv7PrimaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => embeddingDocument.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    tokenCount: integer('token_count'),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS })
      .notNull()
      .$type<number[]>(),
    metadata: jsonb('metadata')
      .$type<EmbeddingMetadata>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('embedding_chunk_document_id_idx').on(table.documentId),
    uniqueIndex('embedding_chunk_document_index_uidx').on(
      table.documentId,
      table.chunkIndex,
    ),
    uniqueIndex('embedding_chunk_document_hash_uidx').on(
      table.documentId,
      table.contentHash,
    ),
    index('embedding_chunk_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export const embeddingDocumentRelations = relations(
  embeddingDocument,
  ({ many, one }) => ({
    organization: one(organization, {
      fields: [embeddingDocument.organizationId],
      references: [organization.id],
    }),
    chunks: many(embeddingChunk),
  }),
);

export const embeddingChunkRelations = relations(embeddingChunk, ({ one }) => ({
  document: one(embeddingDocument, {
    fields: [embeddingChunk.documentId],
    references: [embeddingDocument.id],
  }),
}));
