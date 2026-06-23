import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  auditLog,
  job,
  jobSkill,
  member,
  outboxEvent,
} from '../../../database/drizzle/schema';
import type { MemberRole } from '../../members/domain/member-role';
import { JOB_EVENT_TYPES } from '../domain/job-events';

type Database = typeof database;
export type JobRecord = typeof job.$inferSelect;
export type JobSkillRecord = typeof jobSkill.$inferSelect;

export interface JobActorRecord {
  id: string;
  userId: string;
  role: MemberRole;
}

export interface JobWithSkillsRecord {
  job: JobRecord;
  skills: JobSkillRecord[];
}

export interface UpsertJobSkillInput {
  skill: string;
  required: boolean;
}

export type CreateJobInput = Omit<
  typeof job.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
> & {
  actorUserId: string;
};

export type UpdateJobInput = Partial<
  Omit<
    typeof job.$inferInsert,
    | 'id'
    | 'organizationId'
    | 'recruiterId'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
  >
> & {
  organizationId: string;
  jobId: string;
  actorUserId: string;
};

@Injectable()
export class JobsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActorMember(
    organizationId: string,
    userId: string,
  ): Promise<JobActorRecord | null> {
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

  async findById(
    organizationId: string,
    jobId: string,
  ): Promise<JobWithSkillsRecord | null> {
    const [jobRecord] = await this.db
      .select()
      .from(job)
      .where(and(eq(job.organizationId, organizationId), eq(job.id, jobId)))
      .limit(1);

    if (!jobRecord) {
      return null;
    }

    const skills = await this.listSkills(jobId);

    return {
      job: jobRecord,
      skills,
    };
  }

  async create(input: CreateJobInput): Promise<JobWithSkillsRecord> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(job)
        .values({
          organizationId: input.organizationId,
          recruiterId: input.recruiterId,
          title: input.title,
          area: input.area,
          department: input.department,
          seniority: input.seniority,
          workMode: input.workMode,
          locationCity: input.locationCity,
          locationState: input.locationState,
          locationCountry: input.locationCountry,
          contractType: input.contractType,
          salaryMin: input.salaryMin,
          salaryMax: input.salaryMax,
          salaryCurrency: input.salaryCurrency,
          summary: input.summary,
          responsibilities: input.responsibilities,
          requirements: input.requirements,
          niceToHave: input.niceToHave,
          benefits: input.benefits,
          vacanciesCount: input.vacanciesCount,
          appliesUntil: input.appliesUntil,
          maxApplicants: input.maxApplicants,
          status: input.status,
        })
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: JOB_EVENT_TYPES.created,
        entityId: created.id,
        payload: {
          status: created.status,
          title: created.title,
        },
      });

      return {
        job: created,
        skills: [],
      };
    });
  }

  async update(input: UpdateJobInput): Promise<JobWithSkillsRecord | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(job)
        .set({
          title: input.title,
          area: input.area,
          department: input.department,
          seniority: input.seniority,
          workMode: input.workMode,
          locationCity: input.locationCity,
          locationState: input.locationState,
          locationCountry: input.locationCountry,
          contractType: input.contractType,
          salaryMin: input.salaryMin,
          salaryMax: input.salaryMax,
          salaryCurrency: input.salaryCurrency,
          summary: input.summary,
          responsibilities: input.responsibilities,
          requirements: input.requirements,
          niceToHave: input.niceToHave,
          benefits: input.benefits,
          vacanciesCount: input.vacanciesCount,
          appliesUntil: input.appliesUntil,
          maxApplicants: input.maxApplicants,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(job.organizationId, input.organizationId),
            eq(job.id, input.jobId),
          ),
        )
        .returning();

      if (!updated) {
        return null;
      }

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: JOB_EVENT_TYPES.updated,
        entityId: updated.id,
        payload: {
          status: updated.status,
        },
      });

      const skills = await tx
        .select()
        .from(jobSkill)
        .where(eq(jobSkill.jobId, updated.id))
        .orderBy(asc(jobSkill.skill));

      return {
        job: updated,
        skills,
      };
    });
  }

  async transitionStatus(input: {
    organizationId: string;
    jobId: string;
    actorUserId: string;
    status: 'published' | 'paused' | 'closed' | 'archived';
    eventType: (typeof JOB_EVENT_TYPES)[keyof typeof JOB_EVENT_TYPES];
  }): Promise<JobWithSkillsRecord | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(job)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(job.organizationId, input.organizationId),
            eq(job.id, input.jobId),
          ),
        )
        .returning();

      if (!updated) {
        return null;
      }

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        entityId: updated.id,
        payload: {
          status: updated.status,
        },
      });

      const skills = await tx
        .select()
        .from(jobSkill)
        .where(eq(jobSkill.jobId, updated.id))
        .orderBy(asc(jobSkill.skill));

      return {
        job: updated,
        skills,
      };
    });
  }

  async replaceSkills(input: {
    organizationId: string;
    jobId: string;
    actorUserId: string;
    skills: UpsertJobSkillInput[];
  }): Promise<JobWithSkillsRecord | null> {
    return this.db.transaction(async (tx) => {
      const [jobRecord] = await tx
        .select()
        .from(job)
        .where(
          and(
            eq(job.organizationId, input.organizationId),
            eq(job.id, input.jobId),
          ),
        )
        .limit(1)
        .for('update');

      if (!jobRecord) {
        return null;
      }

      await tx.delete(jobSkill).where(eq(jobSkill.jobId, input.jobId));

      const insertedSkills =
        input.skills.length === 0
          ? []
          : await tx
              .insert(jobSkill)
              .values(
                input.skills.map((item) => ({
                  jobId: input.jobId,
                  skill: item.skill,
                  required: item.required,
                })),
              )
              .returning();

      await tx
        .update(job)
        .set({ updatedAt: new Date() })
        .where(eq(job.id, input.jobId));

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: JOB_EVENT_TYPES.skillsUpdated,
        entityId: jobRecord.id,
        payload: {
          skillsCount: input.skills.length,
        },
      });

      return {
        job: {
          ...jobRecord,
          updatedAt: new Date(),
        },
        skills: insertedSkills.sort((left, right) =>
          left.skill.localeCompare(right.skill),
        ),
      };
    });
  }

  private listSkills(jobId: string): Promise<JobSkillRecord[]> {
    return this.db
      .select()
      .from(jobSkill)
      .where(eq(jobSkill.jobId, jobId))
      .orderBy(asc(jobSkill.skill));
  }

  private async writeAuditAndOutbox(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    input: {
      organizationId: string;
      actorUserId: string;
      eventType: string;
      entityId: string;
      payload: Record<string, unknown>;
    },
  ) {
    await tx.insert(auditLog).values({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      action: input.eventType,
      entityType: 'job',
      entityId: input.entityId,
    });

    await tx.insert(outboxEvent).values({
      eventType: input.eventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: 'job',
      entityId: input.entityId,
      payload: input.payload,
    });
  }
}
