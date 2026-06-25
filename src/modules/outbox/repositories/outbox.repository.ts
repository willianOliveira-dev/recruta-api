import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import { outboxEvent } from '../../../database/drizzle/schema';

type Database = typeof database;
export type OutboxEventRecord = typeof outboxEvent.$inferSelect;

@Injectable()
export class OutboxRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async claimPending(input: {
    limit: number;
    lockedBy: string;
    now: Date;
  }): Promise<OutboxEventRecord[]> {
    return this.db.transaction(async (tx) => {
      const dueEvents = await tx
        .select()
        .from(outboxEvent)
        .where(
          and(
            inArray(outboxEvent.status, ['pending', 'failed']),
            or(
              isNull(outboxEvent.nextAttemptAt),
              lte(outboxEvent.nextAttemptAt, input.now),
            ),
          ),
        )
        .orderBy(asc(outboxEvent.occurredAt), asc(outboxEvent.id))
        .limit(input.limit);

      if (dueEvents.length === 0) {
        return [];
      }

      const eventIds = dueEvents.map((event) => event.id);

      return tx
        .update(outboxEvent)
        .set({
          status: 'processing',
          lockedAt: input.now,
          lockedBy: input.lockedBy,
          updatedAt: input.now,
        })
        .where(inArray(outboxEvent.id, eventIds))
        .returning();
    });
  }

  async markPublished(eventId: string, publishedAt: Date): Promise<void> {
    await this.db
      .update(outboxEvent)
      .set({
        status: 'published',
        publishedAt,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        updatedAt: publishedAt,
      })
      .where(eq(outboxEvent.id, eventId));
  }

  async markFailed(input: {
    eventId: string;
    attempts: number;
    error: string;
    nextAttemptAt: Date;
    failedAt: Date;
  }): Promise<void> {
    await this.db
      .update(outboxEvent)
      .set({
        status: 'failed',
        attempts: input.attempts,
        nextAttemptAt: input.nextAttemptAt,
        lockedAt: null,
        lockedBy: null,
        lastError: input.error,
        updatedAt: input.failedAt,
      })
      .where(eq(outboxEvent.id, input.eventId));
  }
}
