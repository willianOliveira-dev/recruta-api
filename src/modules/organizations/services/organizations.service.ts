import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import { normalizeCnpj } from '../domain/brazilian-company-document';
import { normalizePostalCode } from '../domain/brazilian-postal-code';
import { OrganizationSlug } from '../domain/organization-slug';
import type { CreateOrganizationDto } from '../dto/create-organization.dto';
import type { OrganizationProfileDto } from '../dto/organization-profile.dto';
import type {
  OrganizationProfileResponseDto,
  OrganizationResponseDto,
} from '../dto/organization-response.dto';
import { OrganizationsRepository } from '../repositories/organizations.repository';

const ORGANIZATION_SLUG_UNIQUE_CONSTRAINT = 'organization_slug_uidx';
const ORGANIZATION_PROFILE_CNPJ_UNIQUE_CONSTRAINT =
  'organization_profile_cnpj_uidx';
const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const SLUG_SUFFIX_ATTEMPTS = 5;
const ORGANIZATION_PROFILE_MANAGER_ROLES = new Set(['owner', 'admin']);

interface DatabaseError {
  code?: string;
  constraint?: string;
}

interface OrganizationProfileData {
  legalName?: string | null;
  tradeName?: string | null;
  cnpj?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  careersPageUrl?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  phone?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  street?: string | null;
  district?: string | null;
  postalCode?: string | null;
  description?: string | null;
}

interface OrganizationResponseData {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
  member: {
    role: string;
  };
  profile?: OrganizationProfileData | null;
}

const isDatabaseError = (error: unknown): error is DatabaseError =>
  typeof error === 'object' && error !== null;

const isUniqueViolation = (error: unknown, constraint: string) =>
  isDatabaseError(error) &&
  error.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
  error.constraint === constraint;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  async create(
    session: AuthenticatedSession,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const baseSlug = OrganizationSlug.fromValue(dto.slug ?? dto.name);
    const profile = this.normalizeProfile(dto.profile);

    for (let attempt = 0; attempt <= SLUG_SUFFIX_ATTEMPTS; attempt += 1) {
      const slug = this.slugForAttempt(baseSlug, attempt);

      try {
        const created = await this.organizationsRepository.createWithOwner({
          name: dto.name,
          slug,
          ownerUserId: session.user.id,
          sessionToken: session.session.token,
          profile,
        });

        return this.toResponse(created);
      } catch (error) {
        
        this.throwProfileConflictIfNeeded(error);

        if (isUniqueViolation(error, ORGANIZATION_SLUG_UNIQUE_CONSTRAINT)) {
          if (attempt < SLUG_SUFFIX_ATTEMPTS) {
            continue;
          }

          this.throwSlugUnavailable();
        }

        throw error;
      }
    }

    this.throwSlugUnavailable();
  }

  async getCurrent(
    session: AuthenticatedSession,
  ): Promise<OrganizationResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const scopedOrganization =
      await this.organizationsRepository.findScopedOrganization(
        session.user.id,
        organizationId,
      );

    if (!scopedOrganization) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_SCOPE_FORBIDDEN',
        message: 'User is not a member of the active organization',
      });
    }

    return this.toResponse(scopedOrganization);
  }

  async updateCurrentProfile(
    session: AuthenticatedSession,
    dto: OrganizationProfileDto,
  ): Promise<OrganizationResponseDto> {
    const current = await this.getCurrent(session);
    this.assertCanUpdateProfile(current.role);
    const normalizedProfile = this.normalizeRequiredProfile(dto);

    let profile: OrganizationProfileData;

    try {
      profile = await this.organizationsRepository.upsertProfile(
        current.id,
        session.user.id,
        normalizedProfile,
      );
    } catch (error) {
      this.throwProfileConflictIfNeeded(error);
      throw error;
    }

    return {
      ...current,
      profile: this.toProfileResponse(profile),
    };
  }

  private slugForAttempt(baseSlug: OrganizationSlug, attempt: number) {
    if (attempt === 0) {
      return baseSlug.toString();
    }

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
    return baseSlug.withSuffix(suffix).toString();
  }

  private normalizeProfile(
    profile?: OrganizationProfileDto,
  ): OrganizationProfileDto | undefined {
    if (!profile) {
      return undefined;
    }

    const normalizedProfile: OrganizationProfileDto = { ...profile };

    if (profile.cnpj) {
      normalizedProfile.cnpj = normalizeCnpj(profile.cnpj);
    }

    if (profile.postalCode) {
      normalizedProfile.postalCode = normalizePostalCode(profile.postalCode);
    }

    return normalizedProfile;
  }

  private normalizeRequiredProfile(
    profile: OrganizationProfileDto,
  ): OrganizationProfileDto {
    return this.normalizeProfile(profile) ?? {};
  }

  private assertCanUpdateProfile(role: string) {
    if (ORGANIZATION_PROFILE_MANAGER_ROLES.has(role)) {
      return;
    }

    throw new ForbiddenException({
      code: 'ORGANIZATION_PROFILE_UPDATE_FORBIDDEN',
      message: 'Only organization owners and admins can update profile',
    });
  }

  private throwSlugUnavailable(): never {
    throw new ConflictException({
      code: 'ORGANIZATION_SLUG_UNAVAILABLE',
      message: 'Organization slug is unavailable',
    });
  }

  private throwProfileConflictIfNeeded(error: unknown): void {
    if (
      !isUniqueViolation(error, ORGANIZATION_PROFILE_CNPJ_UNIQUE_CONSTRAINT)
    ) {
      return;
    }

    throw new ConflictException({
      code: 'ORGANIZATION_PROFILE_CNPJ_UNAVAILABLE',
      message: 'Organization CNPJ is already in use',
    });
  }

  private getActiveOrganizationId(session: AuthenticatedSession) {
    if (!session.session.activeOrganizationId) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_ORGANIZATION',
        message: 'No active organization selected',
      });
    }

    return session.session.activeOrganizationId;
  }

  private toResponse(data: OrganizationResponseData): OrganizationResponseDto {
    return {
      id: data.organization.id,
      name: data.organization.name,
      slug: data.organization.slug,
      logo: data.organization.logo,
      role: data.member.role,
      profile: this.toProfileResponse(data.profile),
    };
  }

  private toProfileResponse(
    profile?: OrganizationProfileData | null,
  ): OrganizationProfileResponseDto | null {
    if (!profile) {
      return null;
    }

    return {
      legalName: profile.legalName ?? null,
      tradeName: profile.tradeName ?? null,
      cnpj: profile.cnpj ?? null,
      website: profile.website ?? null,
      linkedinUrl: profile.linkedinUrl ?? null,
      careersPageUrl: profile.careersPageUrl ?? null,
      industry: profile.industry ?? null,
      employeeCount: profile.employeeCount ?? null,
      phone: profile.phone ?? null,
      country: profile.country ?? null,
      state: profile.state ?? null,
      city: profile.city ?? null,
      street: profile.street ?? null,
      district: profile.district ?? null,
      postalCode: profile.postalCode ?? null,
      description: profile.description ?? null,
    };
  }
}
