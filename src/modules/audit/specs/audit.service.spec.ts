import { ForbiddenException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { AuditRepository } from '../repositories/audit.repository';

jest.mock('../repositories/audit.repository', () => ({
  AuditRepository: class AuditRepository {},
}));

import { AuditService } from '../services/audit.service';

interface AuditRepositoryMock {
  findActorMember: jest.Mock;
  list: jest.Mock;
  record: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const actorMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e1';
const auditLogId = '01972194-7d9f-7000-9c9e-b2abdc1d9010';
const entityId = '01972194-7d9f-7000-9c9e-b2abdc1d9002';
const now = new Date('2026-06-24T12:00:00.000Z');

const session: AuthenticatedSession = {
  user: {
    id: actorUserId,
    email: 'owner@recruta.test',
    name: 'Owner',
  },
  session: {
    id: '01972194-7d9f-7000-9c9e-b2abdc1d88df',
    token: 'session-token',
    activeOrganizationId: organizationId,
  },
};

const makeActor = (role: 'owner' | 'recruiter' | 'member' = 'owner') => ({
  id: actorMemberId,
  userId: actorUserId,
  role,
});

const makeAuditLog = () => ({
  id: auditLogId,
  organizationId,
  userId: actorUserId,
  action: 'application.stage.changed',
  entityType: 'application',
  entityId,
  createdAt: now,
});

describe('AuditService', () => {
  let repository: AuditRepositoryMock;
  let logger: LoggerMock;
  let service: AuditService;

  beforeEach(() => {
    repository = {
      findActorMember: jest.fn(),
      list: jest.fn(),
      record: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    service = new AuditService(
      repository as unknown as AuditRepository,
      logger as unknown as ApplicationLogger,
    );
  });

  it('lists organization audit logs for owners only', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    repository.list.mockResolvedValue({
      items: [makeAuditLog()],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const response = await service.listForCurrentOrganization(session, {
      entityType: 'application',
    });

    expect(response.total).toBe(1);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        entityType: 'application',
      }),
    );
  });

  it('rejects audit listing for recruiters', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));

    await expect(
      service.listForCurrentOrganization(session, {}),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.list).not.toHaveBeenCalled();
  });
});
