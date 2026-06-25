import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import { auditLog, member } from '../../../database/drizzle/schema';
import type { MemberRole } from '../../members/domain/member-role';
import type { AuditLogQueryDto } from '../dto/audit-log-query.dto';

type AuditLogRecord = typeof auditLog.$inferSelect;
type Database = typeof database;

export interface AuditActorRecord {
  id: string;
  userId: string;
  role: MemberRole;
}

export interface AuditLogListInput extends AuditLogQueryDto {
  organizationId: string;
}

export interface AuditLogListResult {
  items: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AuditRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActorMember(
    organizationId: string,
    userId: string,
  ): Promise<AuditActorRecord | null> {
    const [row] = await this.db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
      })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, userId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async list(input: AuditLogListInput): Promise<AuditLogListResult> {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const filters = [
      eq(auditLog.organizationId, input.organizationId),
      input.action ? eq(auditLog.action, input.action) : undefined,
      input.entityType ? eq(auditLog.entityType, input.entityType) : undefined,
      input.entityId ? eq(auditLog.entityId, input.entityId) : undefined,
      input.userId ? eq(auditLog.userId, input.userId) : undefined,
      input.from ? gte(auditLog.createdAt, new Date(input.from)) : undefined,
      input.to ? lte(auditLog.createdAt, new Date(input.to)) : undefined,
    ].filter((item): item is Exclude<typeof item, undefined> =>
      Boolean(item),
    );
    const where = and(...filters);

    const [items, totalRows] = await Promise.all([
      this.db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt), asc(auditLog.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where),
    ]);

    return {
      items,
      total: totalRows[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  async record(input: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
  }): Promise<AuditLogRecord> {
    const [created] = await this.db.insert(auditLog).values(input).returning();
    return created;
  }
}
