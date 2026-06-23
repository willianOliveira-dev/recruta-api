import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  auditLog,
  candidate,
  candidateExperience,
  candidateSkill,
  member,
  outboxEvent,
} from '../../../database/drizzle/schema';
import type { MemberRole } from '../../members/domain/member-role';

type Database = typeof database;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type CandidateRecord = typeof candidate.$inferSelect;
export type CandidateSkillRecord = typeof candidateSkill.$inferSelect;
export type CandidateExperienceRecord = typeof candidateExperience.$inferSelect;

export interface CandidateActorRecord {
  id: string;
  userId: string;
  role: MemberRole;
}

export interface CandidateWithDetailsRecord {
  candidate: CandidateRecord;
  skills: CandidateSkillRecord[];
  experiences: CandidateExperienceRecord[];
}

export interface UpsertCandidateSkillInput {
  skill: string;
  years: number | null;
}

export interface UpsertCandidateExperienceInput {
  company: string;
  role: string;
  description: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  isCurrent: boolean;
}

export type CreateCandidateInput = Omit<
  typeof candidate.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
> & {
  actorUserId: string;
};

export type UpdateCandidateInput = Partial<
  Omit<
    typeof candidate.$inferInsert,
    'id' | 'organizationId' | 'createdAt' | 'updatedAt'
  >
> & {
  organizationId: string;
  candidateId: string;
  actorUserId: string;
};

@Injectable()
export class CandidatesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActorMember(
    organizationId: string,
    userId: string,
  ): Promise<CandidateActorRecord | null> {
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
    candidateId: string,
  ): Promise<CandidateWithDetailsRecord | null> {
    const [candidateRecord] = await this.db
      .select()
      .from(candidate)
      .where(
        and(
          eq(candidate.organizationId, organizationId),
          eq(candidate.id, candidateId),
        ),
      )
      .limit(1);

    if (!candidateRecord) {
      return null;
    }

    const [skills, experiences] = await Promise.all([
      this.listSkills(candidateId),
      this.listExperiences(candidateId),
    ]);

    return {
      candidate: candidateRecord,
      skills,
      experiences,
    };
  }

  async create(
    input: CreateCandidateInput,
  ): Promise<CandidateWithDetailsRecord> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(candidate)
        .values({
          organizationId: input.organizationId,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          documentCpf: input.documentCpf,
          birthDate: input.birthDate,
          city: input.city,
          state: input.state,
          country: input.country,
          linkedinUrl: input.linkedinUrl,
          githubUrl: input.githubUrl,
          portfolioUrl: input.portfolioUrl,
          resumeUrl: input.resumeUrl,
          resumeText: input.resumeText,
          workModePreference: input.workModePreference,
          availability: input.availability,
          salaryExpectation: input.salaryExpectation,
          salaryCurrency: input.salaryCurrency,
          seniority: input.seniority,
          yearsOfExperience: input.yearsOfExperience,
          educationDegree: input.educationDegree,
          educationInstitution: input.educationInstitution,
          educationYear: input.educationYear,
        })
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: 'candidate.created',
        entityId: created.id,
        payload: {
          hasResumeUrl: Boolean(created.resumeUrl),
          hasResumeText: Boolean(created.resumeText),
        },
      });

      return {
        candidate: created,
        skills: [],
        experiences: [],
      };
    });
  }

  async update(
    input: UpdateCandidateInput,
  ): Promise<CandidateWithDetailsRecord | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(candidate)
        .set({
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          documentCpf: input.documentCpf,
          birthDate: input.birthDate,
          city: input.city,
          state: input.state,
          country: input.country,
          linkedinUrl: input.linkedinUrl,
          githubUrl: input.githubUrl,
          portfolioUrl: input.portfolioUrl,
          resumeUrl: input.resumeUrl,
          resumeText: input.resumeText,
          workModePreference: input.workModePreference,
          availability: input.availability,
          salaryExpectation: input.salaryExpectation,
          salaryCurrency: input.salaryCurrency,
          seniority: input.seniority,
          yearsOfExperience: input.yearsOfExperience,
          educationDegree: input.educationDegree,
          educationInstitution: input.educationInstitution,
          educationYear: input.educationYear,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(candidate.organizationId, input.organizationId),
            eq(candidate.id, input.candidateId),
          ),
        )
        .returning();

      if (!updated) {
        return null;
      }

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: 'candidate.updated',
        entityId: updated.id,
        payload: {
          hasResumeUrl: Boolean(updated.resumeUrl),
          hasResumeText: Boolean(updated.resumeText),
        },
      });

      return this.withDetails(tx, updated);
    });
  }

  async updateResume(input: {
    organizationId: string;
    candidateId: string;
    actorUserId: string;
    resumeUrl?: string | null;
    resumeText?: string | null;
  }): Promise<CandidateWithDetailsRecord | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(candidate)
        .set({
          resumeUrl: input.resumeUrl,
          resumeText: input.resumeText,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(candidate.organizationId, input.organizationId),
            eq(candidate.id, input.candidateId),
          ),
        )
        .returning();

      if (!updated) {
        return null;
      }

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: 'candidate.resume.updated',
        entityId: updated.id,
        payload: {
          hasResumeUrl: Boolean(updated.resumeUrl),
          hasResumeText: Boolean(updated.resumeText),
        },
      });

      return this.withDetails(tx, updated);
    });
  }

  async replaceSkills(input: {
    organizationId: string;
    candidateId: string;
    actorUserId: string;
    skills: UpsertCandidateSkillInput[];
  }): Promise<CandidateWithDetailsRecord | null> {
    return this.db.transaction(async (tx) => {
      const candidateRecord = await this.lockCandidate(
        tx,
        input.organizationId,
        input.candidateId,
      );

      if (!candidateRecord) {
        return null;
      }

      await tx
        .delete(candidateSkill)
        .where(eq(candidateSkill.candidateId, input.candidateId));

      if (input.skills.length > 0) {
        await tx.insert(candidateSkill).values(
          input.skills.map((item) => ({
            candidateId: input.candidateId,
            skill: item.skill,
            years: item.years,
          })),
        );
      }

      const [updated] = await tx
        .update(candidate)
        .set({ updatedAt: new Date() })
        .where(eq(candidate.id, input.candidateId))
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: 'candidate.skills.updated',
        entityId: candidateRecord.id,
        payload: {
          skillsCount: input.skills.length,
        },
      });

      return this.withDetails(tx, updated ?? candidateRecord);
    });
  }

  async replaceExperiences(input: {
    organizationId: string;
    candidateId: string;
    actorUserId: string;
    experiences: UpsertCandidateExperienceInput[];
  }): Promise<CandidateWithDetailsRecord | null> {
    return this.db.transaction(async (tx) => {
      const candidateRecord = await this.lockCandidate(
        tx,
        input.organizationId,
        input.candidateId,
      );

      if (!candidateRecord) {
        return null;
      }

      await tx
        .delete(candidateExperience)
        .where(eq(candidateExperience.candidateId, input.candidateId));

      if (input.experiences.length > 0) {
        await tx.insert(candidateExperience).values(
          input.experiences.map((item) => ({
            candidateId: input.candidateId,
            company: item.company,
            role: item.role,
            description: item.description,
            startedAt: item.startedAt,
            endedAt: item.endedAt,
            isCurrent: item.isCurrent,
          })),
        );
      }

      const [updated] = await tx
        .update(candidate)
        .set({ updatedAt: new Date() })
        .where(eq(candidate.id, input.candidateId))
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: 'candidate.experiences.updated',
        entityId: candidateRecord.id,
        payload: {
          experiencesCount: input.experiences.length,
        },
      });

      return this.withDetails(tx, updated ?? candidateRecord);
    });
  }

  private async lockCandidate(
    tx: Transaction,
    organizationId: string,
    candidateId: string,
  ) {
    const [candidateRecord] = await tx
      .select()
      .from(candidate)
      .where(
        and(
          eq(candidate.organizationId, organizationId),
          eq(candidate.id, candidateId),
        ),
      )
      .limit(1)
      .for('update');

    return candidateRecord ?? null;
  }

  private async withDetails(
    tx: Pick<Transaction, 'select'>,
    candidateRecord: CandidateRecord,
  ): Promise<CandidateWithDetailsRecord> {
    const skills = await tx
      .select()
      .from(candidateSkill)
      .where(eq(candidateSkill.candidateId, candidateRecord.id))
      .orderBy(asc(candidateSkill.skill));

    const experiences = await tx
      .select()
      .from(candidateExperience)
      .where(eq(candidateExperience.candidateId, candidateRecord.id))
      .orderBy(
        desc(candidateExperience.startedAt),
        asc(candidateExperience.company),
      );

    return {
      candidate: candidateRecord,
      skills,
      experiences,
    };
  }

  private listSkills(candidateId: string): Promise<CandidateSkillRecord[]> {
    return this.db
      .select()
      .from(candidateSkill)
      .where(eq(candidateSkill.candidateId, candidateId))
      .orderBy(asc(candidateSkill.skill));
  }

  private listExperiences(
    candidateId: string,
  ): Promise<CandidateExperienceRecord[]> {
    return this.db
      .select()
      .from(candidateExperience)
      .where(eq(candidateExperience.candidateId, candidateId))
      .orderBy(
        desc(candidateExperience.startedAt),
        asc(candidateExperience.company),
      );
  }

  private async writeAuditAndOutbox(
    tx: Transaction,
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
      entityType: 'candidate',
      entityId: input.entityId,
    });

    await tx.insert(outboxEvent).values({
      eventType: input.eventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: 'candidate',
      entityId: input.entityId,
      payload: input.payload,
    });
  }
}
