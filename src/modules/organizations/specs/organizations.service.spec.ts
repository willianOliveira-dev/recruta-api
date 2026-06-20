import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { OrganizationProfileDto } from '../dto/organization-profile.dto';
import type { OrganizationsRepository } from '../repositories/organizations.repository';

jest.mock('../repositories/organizations.repository', () => ({
  OrganizationsRepository: class OrganizationsRepository {},
}));

import { OrganizationsService } from '../services/organizations.service';

interface RepositoryMock {
  createWithOwner: jest.Mock;
  findScopedOrganization: jest.Mock;
  upsertProfile: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

interface CreateOrganizationInputMock {
  slug: string;
}

const session: AuthenticatedSession = {
  user: {
    id: '01972194-7d9f-7000-9c9e-b2abdc1d88de',
    email: 'owner@recruta.test',
    name: 'Owner',
  },
  session: {
    id: '01972194-7d9f-7000-9c9e-b2abdc1d88df',
    token: 'session-token',
    activeOrganizationId: '01972194-7d9f-7000-9c9e-b2abdc1d88e0',
  },
};

const makeScopedOrganization = (role: string) => ({
  organization: {
    id: session.session.activeOrganizationId as string,
    name: 'Recruta Tecnologia',
    slug: 'recruta-tecnologia',
    logo: null,
  },
  member: {
    role,
  },
  profile: null,
});

const makeCreatedOrganization = (slug: string) => ({
  organization: {
    id: '01972194-7d9f-7000-9c9e-b2abdc1d88e1',
    name: 'Recruta Tecnologia',
    slug,
    logo: null,
  },
  member: {
    role: 'owner',
  },
  profile: null,
});

const uniqueViolation = (constraint: string) =>
  Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint,
  });

describe('OrganizationsService', () => {
  let repository: RepositoryMock;
  let logger: LoggerMock;
  let service: OrganizationsService;

  beforeEach(() => {
    repository = {
      createWithOwner: jest.fn(),
      findScopedOrganization: jest.fn(),
      upsertProfile: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    service = new OrganizationsService(
      repository as unknown as OrganizationsRepository,
      logger as unknown as ApplicationLogger,
    );
  });

  it('retries organization creation with a suffixed slug when a concurrent insert takes the base slug', async () => {
    let attempt = 0;

    repository.createWithOwner.mockImplementation(
      (input: CreateOrganizationInputMock) => {
        attempt += 1;

        if (attempt === 1) {
          return Promise.reject(uniqueViolation('organization_slug_uidx'));
        }

        return Promise.resolve(makeCreatedOrganization(input.slug));
      },
    );

    const response = await service.create(session, {
      name: 'Recruta Tecnologia',
    });

    expect(repository.createWithOwner).toHaveBeenCalledTimes(2);
    expect(repository.createWithOwner).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ slug: 'recruta-tecnologia' }),
    );
    expect(response.slug).toMatch(/^recruta-tecnologia-[a-f0-9]{8}$/);
  });

  it('maps organization profile CNPJ uniqueness violations to a conflict response', async () => {
    repository.createWithOwner.mockRejectedValue(
      uniqueViolation('organization_profile_cnpj_uidx'),
    );

    await expect(
      service.create(session, {
        name: 'Recruta Tecnologia',
        profile: { cnpj: '12345678000199' },
      }),
    ).rejects.toThrow(ConflictException);
  });

  it.each(['member', 'recruiter'])(
    'rejects profile updates from %s members',
    async (role) => {
      repository.findScopedOrganization.mockResolvedValue(
        makeScopedOrganization(role),
      );

      await expect(
        service.updateCurrentProfile(session, { tradeName: 'Recruta' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.upsertProfile).not.toHaveBeenCalled();
    },
  );

  it.each(['owner', 'admin'])(
    'allows %s members to update profile address fields',
    async (role) => {
      const profile: OrganizationProfileDto = {
        street: 'Rua das ATS',
        district: 'Centro',
        postalCode: '01001-000',
      };
      const normalizedProfile = {
        street: 'Rua das ATS',
        district: 'Centro',
        postalCode: '01001000',
      };
      const savedProfile = {
        organizationId: session.session.activeOrganizationId as string,
        ...normalizedProfile,
      };

      repository.findScopedOrganization.mockResolvedValue(
        makeScopedOrganization(role),
      );
      repository.upsertProfile.mockResolvedValue(savedProfile);

      const response = await service.updateCurrentProfile(session, profile);

      expect(response.role).toBe(role);
      expect(response.profile).toMatchObject(normalizedProfile);
      expect(response.profile).not.toHaveProperty('organizationId');
      expect(repository.upsertProfile).toHaveBeenCalledWith(
        session.session.activeOrganizationId,
        session.user.id,
        normalizedProfile,
      );
    },
  );

  it('normalizes CNPJ and postal code before saving profile data', async () => {
    const profile: OrganizationProfileDto = {
      cnpj: '11.222.333/0001-81',
      postalCode: '01001-000',
    };
    const normalizedProfile = {
      cnpj: '11222333000181',
      postalCode: '01001000',
    };

    repository.findScopedOrganization.mockResolvedValue(
      makeScopedOrganization('owner'),
    );
    repository.upsertProfile.mockResolvedValue(normalizedProfile);

    await service.updateCurrentProfile(session, profile);

    expect(repository.upsertProfile).toHaveBeenCalledWith(
      session.session.activeOrganizationId,
      session.user.id,
      normalizedProfile,
    );
  });

  it('maps CNPJ conflicts during profile update to a conflict response', async () => {
    repository.findScopedOrganization.mockResolvedValue(
      makeScopedOrganization('owner'),
    );
    repository.upsertProfile.mockRejectedValue(
      uniqueViolation('organization_profile_cnpj_uidx'),
    );

    await expect(
      service.updateCurrentProfile(session, { cnpj: '12345678000199' }),
    ).rejects.toThrow(ConflictException);
  });
});
