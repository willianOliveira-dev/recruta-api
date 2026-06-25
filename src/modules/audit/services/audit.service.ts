import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  APP_LOGGER,
  type ApplicationLogger,
} from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import { AUDIT_VIEWER_ROLES } from '../domain/audit-permissions';
import type { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import type {
  AuditLogListResponseDto,
  AuditLogResponseDto,
} from '../dto/audit-log-response.dto';
import {
  type AuditActorRecord,
  AuditRepository,
} from '../repositories/audit.repository';

@Injectable()
export class AuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async listForCurrentOrganization(
    session: AuthenticatedSession,
    query: AuditLogQueryDto,
  ): Promise<AuditLogListResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertCanViewAudit(session, organizationId);

    const result = await this.auditRepository.list({
      organizationId,
      ...query,
    });

    this.logger.log(
      {
        event: 'audit.listed',
        organizationId,
        actorUserId: session.user.id,
        filters: {
          hasAction: Boolean(query.action),
          hasEntityType: Boolean(query.entityType),
          hasEntityId: Boolean(query.entityId),
          hasUserId: Boolean(query.userId),
          hasDateRange: Boolean(query.from || query.to),
        },
      },
      'AuditService',
    );

    return {
      ...result,
      items: result.items.map((item) => this.toResponse(item)),
    };
  }

  async record(input: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
  }): Promise<AuditLogResponseDto> {
    const created = await this.auditRepository.record(input);
    return this.toResponse(created);
  }

  private async assertCanViewAudit(
    session: AuthenticatedSession,
    organizationId: string,
  ) {
    const actor = await this.getScopedActor(session, organizationId);

    if (AUDIT_VIEWER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'audit.view_forbidden',
        organizationId,
        actorUserId: session.user.id,
        actorRole: actor.role,
      },
      'AuditService',
    );

    throw new ForbiddenException({
      code: 'AUDIT_VIEW_FORBIDDEN',
      message: 'Only organization owners can view audit logs',
    });
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<AuditActorRecord> {
    const actor = await this.auditRepository.findActorMember(
      organizationId,
      session.user.id,
    );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'audit.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'AuditService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
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

  private toResponse(record: {
    id: string;
    organizationId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
  }): AuditLogResponseDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId ?? null,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
