import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentSession } from '../../../common/decorators/current-session.decorator';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { ApiStandardResponse } from '../../../common/http/decorators/api-standard-response.decorator';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLogListResponseDto } from '../dto/audit-log-response.dto';
import { AuditService } from '../services/audit.service';

@ApiTags('Audit')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('organizations/current/audit')
  @ApiOperation({
    summary: 'List current organization audit logs',
    operationId: 'listCurrentOrganizationAuditLogs',
  })
  @ApiStandardResponse({
    description: 'Current organization audit logs listed',
    type: AuditLogListResponseDto,
    errors: [400, 401, 403, 500, 'default'],
  })
  listForCurrentOrganization(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditService.listForCurrentOrganization(session, query);
  }
}
