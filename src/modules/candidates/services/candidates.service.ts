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
import { CANDIDATE_EVENT_TYPES } from '../domain/candidate-events';
import { CANDIDATE_MANAGER_ROLES } from '../domain/candidate-permissions';
import type { CandidateExperienceInputDto } from '../dto/candidate-experience.dto';
import type {
  CandidateExperienceResponseDto,
  CandidateResponseDto,
  CandidateSkillResponseDto,
} from '../dto/candidate-response.dto';
import type { CandidateSkillInputDto } from '../dto/candidate-skill.dto';
import type { CreateCandidateDto } from '../dto/create-candidate.dto';
import type { UpdateCandidateResumeDto } from '../dto/update-candidate-resume.dto';
import type { UpdateCandidateDto } from '../dto/update-candidate.dto';
import {
  type CandidateActorRecord,
  type CandidateExperienceRecord,
  type CandidateSkillRecord,
  type CandidateWithDetailsRecord,
  CandidatesRepository,
} from '../repositories/candidates.repository';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly candidatesRepository: CandidatesRepository,
    private readonly planLimitsService: PlanLimitsService,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async create(
    session: AuthenticatedSession,
    dto: CreateCandidateDto,
  ): Promise<CandidateResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageCandidates(actor, session.user.id, organizationId);
    await this.planLimitsService.assertCanCreateCandidate(organizationId);

    try {
      const created = await this.candidatesRepository.create({
        organizationId,
        actorUserId: session.user.id,
        fullName: this.trim(dto.fullName, 'CANDIDATE_NAME_EMPTY'),
        email: this.normalizeEmail(dto.email),
        phone: this.optionalTrim(dto.phone),
        documentCpf: this.normalizeCpf(dto.documentCpf),
        birthDate: this.toDateOrNull(dto.birthDate),
        city: this.optionalTrim(dto.city),
        state: this.optionalTrim(dto.state),
        country: this.optionalTrim(dto.country),
        linkedinUrl: this.optionalTrim(dto.linkedinUrl),
        githubUrl: this.optionalTrim(dto.githubUrl),
        portfolioUrl: this.optionalTrim(dto.portfolioUrl),
        resumeUrl: this.optionalTrim(dto.resumeUrl),
        resumeText: this.optionalTrim(dto.resumeText),
        workModePreference: dto.workModePreference,
        availability: dto.availability,
        salaryExpectation: dto.salaryExpectation,
        salaryCurrency: this.normalizeCurrency(dto.salaryCurrency),
        seniority: dto.seniority,
        yearsOfExperience: dto.yearsOfExperience,
        educationDegree: this.optionalTrim(dto.educationDegree),
        educationInstitution: this.optionalTrim(dto.educationInstitution),
        educationYear: dto.educationYear,
      });

      this.logger.log(
        {
          event: CANDIDATE_EVENT_TYPES.created,
          organizationId,
          actorUserId: session.user.id,
          candidateId: created.candidate.id,
        },
        'CandidatesService',
      );

      return this.toResponse(created);
    } catch (error) {
      this.mapUniqueCandidateConflict(error);
      throw error;
    }
  }

  async update(
    session: AuthenticatedSession,
    candidateId: string,
    dto: UpdateCandidateDto,
  ): Promise<CandidateResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    try {
      const updated = await this.candidatesRepository.update({
        organizationId,
        candidateId,
        actorUserId: session.user.id,
        fullName:
          dto.fullName === undefined
            ? undefined
            : this.trim(dto.fullName, 'CANDIDATE_NAME_EMPTY'),
        email:
          dto.email === undefined ? undefined : this.normalizeEmail(dto.email),
        phone: this.optionalTrim(dto.phone),
        documentCpf: this.normalizeCpf(dto.documentCpf),
        birthDate:
          dto.birthDate === undefined
            ? undefined
            : this.toDateOrNull(dto.birthDate),
        city: this.optionalTrim(dto.city),
        state: this.optionalTrim(dto.state),
        country: this.optionalTrim(dto.country),
        linkedinUrl: this.optionalTrim(dto.linkedinUrl),
        githubUrl: this.optionalTrim(dto.githubUrl),
        portfolioUrl: this.optionalTrim(dto.portfolioUrl),
        resumeUrl: this.optionalTrim(dto.resumeUrl),
        resumeText: this.optionalTrim(dto.resumeText),
        workModePreference: dto.workModePreference,
        availability: dto.availability,
        salaryExpectation: dto.salaryExpectation,
        salaryCurrency:
          dto.salaryCurrency === undefined
            ? undefined
            : this.normalizeCurrency(dto.salaryCurrency),
        seniority: dto.seniority,
        yearsOfExperience: dto.yearsOfExperience,
        educationDegree: this.optionalTrim(dto.educationDegree),
        educationInstitution: this.optionalTrim(dto.educationInstitution),
        educationYear: dto.educationYear,
      });

      if (!updated) {
        this.throwCandidateNotFound();
      }

      this.logger.log(
        {
          event: CANDIDATE_EVENT_TYPES.updated,
          organizationId,
          actorUserId: session.user.id,
          candidateId,
        },
        'CandidatesService',
      );

      return this.toResponse(updated);
    } catch (error) {
      this.mapUniqueCandidateConflict(error);
      throw error;
    }
  }

  async replaceSkills(
    session: AuthenticatedSession,
    candidateId: string,
    skills: CandidateSkillInputDto[],
  ): Promise<CandidateResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    const normalizedSkills = this.normalizeSkills(skills);

    const updated = await this.candidatesRepository.replaceSkills({
      organizationId,
      candidateId,
      actorUserId: session.user.id,
      skills: normalizedSkills,
    });

    if (!updated) {
      this.throwCandidateNotFound();
    }

    this.logger.log(
      {
        event: CANDIDATE_EVENT_TYPES.skillsUpdated,
        organizationId,
        actorUserId: session.user.id,
        candidateId,
        skillsCount: normalizedSkills.length,
      },
      'CandidatesService',
    );

    return this.toResponse(updated);
  }

  async replaceExperiences(
    session: AuthenticatedSession,
    candidateId: string,
    experiences: CandidateExperienceInputDto[],
  ): Promise<CandidateResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    const normalizedExperiences = experiences.map((item) =>
      this.normalizeExperience(item),
    );

    const updated = await this.candidatesRepository.replaceExperiences({
      organizationId,
      candidateId,
      actorUserId: session.user.id,
      experiences: normalizedExperiences,
    });

    if (!updated) {
      this.throwCandidateNotFound();
    }

    this.logger.log(
      {
        event: CANDIDATE_EVENT_TYPES.experiencesUpdated,
        organizationId,
        actorUserId: session.user.id,
        candidateId,
        experiencesCount: normalizedExperiences.length,
      },
      'CandidatesService',
    );

    return this.toResponse(updated);
  }

  async updateResume(
    session: AuthenticatedSession,
    candidateId: string,
    dto: UpdateCandidateResumeDto,
  ): Promise<CandidateResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    if (dto.resumeUrl === undefined && dto.resumeText === undefined) {
      throw new BadRequestException({
        code: 'CANDIDATE_RESUME_EMPTY_UPDATE',
        message: 'At least one resume field must be provided',
      });
    }

    const updated = await this.candidatesRepository.updateResume({
      organizationId,
      candidateId,
      actorUserId: session.user.id,
      resumeUrl: this.optionalTrim(dto.resumeUrl),
      resumeText: this.optionalTrim(dto.resumeText),
    });

    if (!updated) {
      this.throwCandidateNotFound();
    }

    this.logger.log(
      {
        event: CANDIDATE_EVENT_TYPES.resumeUpdated,
        organizationId,
        actorUserId: session.user.id,
        candidateId,
      },
      'CandidatesService',
    );

    return this.toResponse(updated);
  }

  private async assertActionAllowed(
    session: AuthenticatedSession,
    organizationId: string,
  ) {
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageCandidates(actor, session.user.id, organizationId);
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<CandidateActorRecord> {
    const actor = await this.candidatesRepository.findActorMember(
      organizationId,
      session.user.id,
    );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'candidate.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'CandidatesService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
  }

  private assertCanManageCandidates(
    actor: CandidateActorRecord,
    actorUserId: string,
    organizationId: string,
  ) {
    if (CANDIDATE_MANAGER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'candidate.manage_forbidden',
        organizationId,
        actorUserId,
        actorRole: actor.role,
      },
      'CandidatesService',
    );

    throw new ForbiddenException({
      code: 'CANDIDATE_MANAGEMENT_FORBIDDEN',
      message: 'Only organization owners and recruiters can manage candidates',
    });
  }

  private normalizeSkills(skills: CandidateSkillInputDto[]) {
    const unique = new Map<string, { skill: string; years: number | null }>();

    for (const item of skills) {
      const skill = this.trim(item.skill, 'CANDIDATE_SKILL_EMPTY');
      unique.set(skill.toLocaleLowerCase(), {
        skill,
        years: item.years ?? null,
      });
    }

    return [...unique.values()];
  }

  private normalizeExperience(item: CandidateExperienceInputDto) {
    const startedAt = this.toDateOrNull(item.startedAt);
    const endedAt = this.toDateOrNull(item.endedAt);
    const isCurrent = item.isCurrent ?? false;

    if (startedAt && endedAt && endedAt < startedAt) {
      throw new BadRequestException({
        code: 'CANDIDATE_EXPERIENCE_DATE_RANGE_INVALID',
        message: 'Candidate experience end date cannot be before start date',
      });
    }

    if (isCurrent && endedAt) {
      throw new BadRequestException({
        code: 'CANDIDATE_EXPERIENCE_CURRENT_WITH_END_DATE',
        message: 'Current candidate experience cannot have an end date',
      });
    }

    return {
      company: this.trim(item.company, 'CANDIDATE_EXPERIENCE_COMPANY_EMPTY'),
      role: this.trim(item.role, 'CANDIDATE_EXPERIENCE_ROLE_EMPTY'),
      description: this.optionalTrim(item.description) ?? null,
      startedAt,
      endedAt,
      isCurrent,
    };
  }

  private normalizeEmail(email: string) {
    return this.trim(email, 'CANDIDATE_EMAIL_EMPTY').toLocaleLowerCase();
  }

  private normalizeCpf(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const digits = value?.replace(/\D/g, '') ?? '';

    if (digits.length === 0) {
      return null;
    }

    if (digits.length !== 11) {
      throw new BadRequestException({
        code: 'CANDIDATE_CPF_INVALID',
        message: 'Candidate CPF must contain 11 digits',
      });
    }

    return digits;
  }

  private normalizeCurrency(currency?: string | null) {
    return this.optionalTrim(currency)?.toUpperCase() ?? 'BRL';
  }

  private toDateOrNull(value?: string | null) {
    return value ? new Date(value) : null;
  }

  private trim(value: string, code: string) {
    const trimmed = value.trim();

    if (trimmed.length > 0) {
      return trimmed;
    }

    throw new BadRequestException({
      code,
      message: 'Candidate text fields cannot be blank',
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

  private mapUniqueCandidateConflict(error: unknown): never | void {
    const constraint = (error as { constraint?: unknown }).constraint;

    if (constraint === 'candidate_org_email_uidx') {
      throw new ConflictException({
        code: 'CANDIDATE_EMAIL_ALREADY_EXISTS',
        message: 'Candidate email already exists in this organization',
      });
    }

    if (constraint === 'candidate_org_document_cpf_uidx') {
      throw new ConflictException({
        code: 'CANDIDATE_CPF_ALREADY_EXISTS',
        message: 'Candidate CPF already exists in this organization',
      });
    }
  }

  private throwCandidateNotFound(): never {
    throw new NotFoundException({
      code: 'CANDIDATE_NOT_FOUND',
      message: 'Organization candidate was not found',
    });
  }

  private toResponse(record: CandidateWithDetailsRecord): CandidateResponseDto {
    return {
      id: record.candidate.id,
      organizationId: record.candidate.organizationId,
      fullName: record.candidate.fullName,
      email: record.candidate.email,
      phone: record.candidate.phone ?? null,
      documentCpf: record.candidate.documentCpf ?? null,
      birthDate: this.toDateString(record.candidate.birthDate),
      city: record.candidate.city ?? null,
      state: record.candidate.state ?? null,
      country: record.candidate.country ?? null,
      linkedinUrl: record.candidate.linkedinUrl ?? null,
      githubUrl: record.candidate.githubUrl ?? null,
      portfolioUrl: record.candidate.portfolioUrl ?? null,
      resumeUrl: record.candidate.resumeUrl ?? null,
      resumeText: record.candidate.resumeText ?? null,
      workModePreference: record.candidate.workModePreference ?? null,
      availability: record.candidate.availability ?? null,
      salaryExpectation: record.candidate.salaryExpectation ?? null,
      salaryCurrency: record.candidate.salaryCurrency ?? 'BRL',
      seniority: record.candidate.seniority ?? null,
      yearsOfExperience: record.candidate.yearsOfExperience ?? null,
      educationDegree: record.candidate.educationDegree ?? null,
      educationInstitution: record.candidate.educationInstitution ?? null,
      educationYear: record.candidate.educationYear ?? null,
      skills: record.skills.map((skill) => this.toSkillResponse(skill)),
      experiences: record.experiences.map((experience) =>
        this.toExperienceResponse(experience),
      ),
      createdAt: record.candidate.createdAt.toISOString(),
      updatedAt: record.candidate.updatedAt.toISOString(),
    };
  }

  private toSkillResponse(
    skill: CandidateSkillRecord,
  ): CandidateSkillResponseDto {
    return {
      id: skill.id,
      skill: skill.skill,
      years: skill.years ?? null,
    };
  }

  private toExperienceResponse(
    experience: CandidateExperienceRecord,
  ): CandidateExperienceResponseDto {
    return {
      id: experience.id,
      company: experience.company,
      role: experience.role,
      description: experience.description ?? null,
      startedAt: this.toDateString(experience.startedAt),
      endedAt: this.toDateString(experience.endedAt),
      isCurrent: experience.isCurrent,
      createdAt: experience.createdAt.toISOString(),
      updatedAt: experience.updatedAt.toISOString(),
    };
  }

  private toDateString(value: Date | null) {
    return value?.toISOString().slice(0, 10) ?? null;
  }
}
