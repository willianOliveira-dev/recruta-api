import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  APP_LOGGER,
  type ApplicationLogger,
} from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import { PlanLimitsService } from '../../subscription-plans/services/plan-limits.service';
import { JOB_EVENT_TYPES } from '../domain/job-events';
import { JOB_MANAGER_ROLES } from '../domain/job-permissions';
import type { CreateJobDto } from '../dto/create-job.dto';
import type { JobSkillInputDto } from '../dto/job-skill.dto';
import type {
  JobResponseDto,
  JobSkillResponseDto,
} from '../dto/job-response.dto';
import type { UpdateJobDto } from '../dto/update-job.dto';
import {
  type JobActorRecord,
  type JobSkillRecord,
  type JobWithSkillsRecord,
  JobsRepository,
} from '../repositories/jobs.repository';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly planLimitsService: PlanLimitsService,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async create(
    session: AuthenticatedSession,
    dto: CreateJobDto,
  ): Promise<JobResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageJobs(actor, session.user.id, organizationId);
    this.assertValidSalaryRange(dto.salaryMin, dto.salaryMax);

    const created = await this.jobsRepository.create({
      organizationId,
      recruiterId: session.user.id,
      actorUserId: session.user.id,
      title: this.trim(dto.title),
      area: this.trim(dto.area),
      department: this.optionalTrim(dto.department),
      seniority: dto.seniority,
      workMode: dto.workMode,
      locationCity: this.optionalTrim(dto.locationCity),
      locationState: this.optionalTrim(dto.locationState),
      locationCountry: this.optionalTrim(dto.locationCountry),
      contractType: dto.contractType,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      salaryCurrency: this.normalizeCurrency(dto.salaryCurrency),
      summary: this.optionalTrim(dto.summary),
      responsibilities: this.optionalTrim(dto.responsibilities),
      requirements: this.optionalTrim(dto.requirements),
      niceToHave: this.optionalTrim(dto.niceToHave),
      benefits: this.optionalTrim(dto.benefits),
      vacanciesCount: dto.vacanciesCount ?? 1,
      appliesUntil: this.toDateOrNull(dto.appliesUntil),
      maxApplicants: dto.maxApplicants,
      status: 'draft',
    });

    this.logger.log(
      {
        event: 'job.created',
        organizationId,
        actorUserId: session.user.id,
        jobId: created.job.id,
        status: created.job.status,
      },
      'JobsService',
    );

    return this.toResponse(created);
  }

  async update(
    session: AuthenticatedSession,
    jobId: string,
    dto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageJobs(actor, session.user.id, organizationId);
    this.assertValidSalaryRange(dto.salaryMin, dto.salaryMax);

    const updated = await this.jobsRepository.update({
      organizationId,
      jobId,
      actorUserId: session.user.id,
      title: dto.title === undefined ? undefined : this.trim(dto.title),
      area: dto.area === undefined ? undefined : this.trim(dto.area),
      department: this.optionalTrim(dto.department),
      seniority: dto.seniority,
      workMode: dto.workMode,
      locationCity: this.optionalTrim(dto.locationCity),
      locationState: this.optionalTrim(dto.locationState),
      locationCountry: this.optionalTrim(dto.locationCountry),
      contractType: dto.contractType,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      salaryCurrency: dto.salaryCurrency
        ? this.normalizeCurrency(dto.salaryCurrency)
        : undefined,
      summary: this.optionalTrim(dto.summary),
      responsibilities: this.optionalTrim(dto.responsibilities),
      requirements: this.optionalTrim(dto.requirements),
      niceToHave: this.optionalTrim(dto.niceToHave),
      benefits: this.optionalTrim(dto.benefits),
      vacanciesCount: dto.vacanciesCount,
      appliesUntil: dto.appliesUntil
        ? this.toDateOrNull(dto.appliesUntil)
        : undefined,
      maxApplicants: dto.maxApplicants,
    });

    if (!updated) {
      this.throwJobNotFound();
    }

    this.logger.log(
      {
        event: 'job.updated',
        organizationId,
        actorUserId: session.user.id,
        jobId,
      },
      'JobsService',
    );

    return this.toResponse(updated);
  }

  async publish(
    session: AuthenticatedSession,
    jobId: string,
  ): Promise<JobResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageJobs(actor, session.user.id, organizationId);

    const target = await this.getTargetJob(organizationId, jobId);

    if (target.job.status === 'published') {
      return this.toResponse(target);
    }

    this.assertValidStatusTransition(target, 'published');

    await this.planLimitsService.assertCanPublishJob(organizationId);

    return this.transition(session, organizationId, jobId, 'published');
  }

  async pause(
    session: AuthenticatedSession,
    jobId: string,
  ): Promise<JobResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    const target = await this.getTargetJob(organizationId, jobId);

    if (target.job.status === 'paused') {
      return this.toResponse(target);
    }

    this.assertValidStatusTransition(target, 'paused');
    return this.transition(session, organizationId, jobId, 'paused');
  }

  async close(
    session: AuthenticatedSession,
    jobId: string,
  ): Promise<JobResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    const target = await this.getTargetJob(organizationId, jobId);

    if (target.job.status === 'closed') {
      return this.toResponse(target);
    }

    this.assertValidStatusTransition(target, 'closed');
    return this.transition(session, organizationId, jobId, 'closed');
  }

  async archive(
    session: AuthenticatedSession,
    jobId: string,
  ): Promise<JobResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    const target = await this.getTargetJob(organizationId, jobId);

    if (target.job.status === 'archived') {
      return this.toResponse(target);
    }

    this.assertValidStatusTransition(target, 'archived');
    return this.transition(session, organizationId, jobId, 'archived');
  }

  async replaceSkills(
    session: AuthenticatedSession,
    jobId: string,
    skills: JobSkillInputDto[],
  ): Promise<JobResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    const normalizedSkills = this.normalizeSkills(skills);

    const updated = await this.jobsRepository.replaceSkills({
      organizationId,
      jobId,
      actorUserId: session.user.id,
      skills: normalizedSkills,
    });

    if (!updated) {
      this.throwJobNotFound();
    }

    this.logger.log(
      {
        event: 'job.skills_updated',
        organizationId,
        actorUserId: session.user.id,
        jobId,
        skillsCount: normalizedSkills.length,
      },
      'JobsService',
    );

    return this.toResponse(updated);
  }

  private async transition(
    session: AuthenticatedSession,
    organizationId: string,
    jobId: string,
    status: 'published' | 'paused' | 'closed' | 'archived',
  ) {
    const eventType = {
      published: JOB_EVENT_TYPES.published,
      paused: JOB_EVENT_TYPES.paused,
      closed: JOB_EVENT_TYPES.closed,
      archived: JOB_EVENT_TYPES.archived,
    }[status];
    const updated = await this.jobsRepository.transitionStatus({
      organizationId,
      jobId,
      actorUserId: session.user.id,
      status,
      eventType,
    });

    if (!updated) {
      this.throwJobNotFound();
    }

    this.logger.log(
      {
        event: eventType,
        organizationId,
        actorUserId: session.user.id,
        jobId,
      },
      'JobsService',
    );

    return this.toResponse(updated);
  }

  private assertValidStatusTransition(
    target: JobWithSkillsRecord,
    nextStatus: 'published' | 'paused' | 'closed' | 'archived',
  ) {
    const currentStatus = target.job.status;

    if (currentStatus === nextStatus) {
      return;
    }

    const allowedTransitions: Record<
      JobWithSkillsRecord['job']['status'],
      readonly JobWithSkillsRecord['job']['status'][]
    > = {
      draft: ['published', 'closed', 'archived'],
      published: ['paused', 'closed', 'archived'],
      paused: ['published', 'closed', 'archived'],
      closed: ['archived'],
      archived: [],
    };

    if (allowedTransitions[currentStatus].includes(nextStatus)) {
      return;
    }

    throw new BadRequestException({
      code: 'JOB_STATUS_TRANSITION_INVALID',
      message: `Cannot change job status from ${currentStatus} to ${nextStatus}`,
    });
  }

  private async assertActionAllowed(
    session: AuthenticatedSession,
    organizationId: string,
  ) {
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageJobs(actor, session.user.id, organizationId);
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<JobActorRecord> {
    const actor = await this.jobsRepository.findActorMember(
      organizationId,
      session.user.id,
    );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'job.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'JobsService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
  }

  private async getTargetJob(
    organizationId: string,
    jobId: string,
  ): Promise<JobWithSkillsRecord> {
    const target = await this.jobsRepository.findById(organizationId, jobId);

    if (target) {
      return target;
    }

    this.throwJobNotFound();
  }

  private assertCanManageJobs(
    actor: JobActorRecord,
    actorUserId: string,
    organizationId: string,
  ) {
    if (JOB_MANAGER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'job.manage_forbidden',
        organizationId,
        actorUserId,
        actorRole: actor.role,
      },
      'JobsService',
    );

    throw new ForbiddenException({
      code: 'JOB_MANAGEMENT_FORBIDDEN',
      message: 'Only organization owners and recruiters can manage jobs',
    });
  }

  private assertValidSalaryRange(salaryMin?: number, salaryMax?: number): void {
    if (
      salaryMin === undefined ||
      salaryMax === undefined ||
      salaryMin <= salaryMax
    ) {
      return;
    }

    throw new BadRequestException({
      code: 'JOB_SALARY_RANGE_INVALID',
      message: 'Job salary minimum cannot be greater than salary maximum',
    });
  }

  private normalizeSkills(skills: JobSkillInputDto[]) {
    const unique = new Map<string, { skill: string; required: boolean }>();

    for (const item of skills) {
      const skill = this.trim(item.skill);
      const key = skill.toLocaleLowerCase();
      unique.set(key, {
        skill,
        required: item.required ?? true,
      });
    }

    return [...unique.values()];
  }

  private normalizeCurrency(currency?: string) {
    return this.optionalTrim(currency)?.toUpperCase() ?? 'BRL';
  }

  private toDateOrNull(value?: string) {
    return value ? new Date(value) : null;
  }

  private trim(value: string) {
    const trimmed = value.trim();

    if (trimmed.length > 0) {
      return trimmed;
    }

    throw new BadRequestException({
      code: 'JOB_FIELD_EMPTY',
      message: 'Job text fields cannot be blank',
    });
  }

  private optionalTrim(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
  }

  private getActiveOrganizationId(session: AuthenticatedSession): string {
    if (!session.session.activeOrganizationId) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_ORGANIZATION',
        message: 'No active organization selected',
      });
    }

    return session.session.activeOrganizationId;
  }

  private throwJobNotFound(): never {
    throw new NotFoundException({
      code: 'JOB_NOT_FOUND',
      message: 'Organization job was not found',
    });
  }

  private toResponse(record: JobWithSkillsRecord): JobResponseDto {
    return {
      id: record.job.id,
      organizationId: record.job.organizationId,
      recruiterId: record.job.recruiterId,
      title: record.job.title,
      area: record.job.area,
      department: record.job.department ?? null,
      seniority: record.job.seniority,
      workMode: record.job.workMode,
      locationCity: record.job.locationCity ?? null,
      locationState: record.job.locationState ?? null,
      locationCountry: record.job.locationCountry ?? null,
      contractType: record.job.contractType,
      salaryMin: record.job.salaryMin ?? null,
      salaryMax: record.job.salaryMax ?? null,
      salaryCurrency: record.job.salaryCurrency,
      summary: record.job.summary ?? null,
      responsibilities: record.job.responsibilities ?? null,
      requirements: record.job.requirements ?? null,
      niceToHave: record.job.niceToHave ?? null,
      benefits: record.job.benefits ?? null,
      vacanciesCount: record.job.vacanciesCount,
      appliesUntil: record.job.appliesUntil?.toISOString() ?? null,
      maxApplicants: record.job.maxApplicants ?? null,
      status: record.job.status,
      skills: record.skills.map((skill) => this.toSkillResponse(skill)),
      createdAt: record.job.createdAt.toISOString(),
      updatedAt: record.job.updatedAt.toISOString(),
    };
  }

  private toSkillResponse(skill: JobSkillRecord): JobSkillResponseDto {
    return {
      id: skill.id,
      skill: skill.skill,
      required: skill.required,
    };
  }
}
