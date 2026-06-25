import {
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponse } from '../../../common/http/decorators/api-standard-response.decorator';
import { env } from '../../../config/env.schema';
import { OutboxPublishResponseDto } from '../dto/outbox-publish-response.dto';
import { OutboxService } from '../services/outbox.service';

class PublishOutboxQueryDto {
  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@ApiTags('Outbox')
@Controller('internal/outbox')
export class OutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  @Post('publish-pending')
  @ApiOperation({
    summary: 'Publish pending outbox events',
    operationId: 'publishPendingOutboxEvents',
  })
  @ApiStandardResponse({
    description: 'Pending outbox events processed',
    type: OutboxPublishResponseDto,
    errors: [400, 403, 503, 500, 'default'],
  })
  publishPending(
    @Query() query: PublishOutboxQueryDto,
    @Headers('x-outbox-publish-secret') secret?: string,
  ) {
    this.assertInternalSecret(secret);
    return this.outboxService.publishPending(query.limit);
  }

  private assertInternalSecret(secret?: string): void {
    if (!env.OUTBOX_PUBLISH_SHARED_SECRET) {
      throw new ServiceUnavailableException({
        code: 'OUTBOX_PUBLISH_SECRET_NOT_CONFIGURED',
        message: 'Outbox publish shared secret is not configured',
      });
    }

    if (secret === env.OUTBOX_PUBLISH_SHARED_SECRET) {
      return;
    }

    throw new ForbiddenException({
      code: 'OUTBOX_PUBLISH_SECRET_INVALID',
      message: 'Outbox publish shared secret is invalid',
    });
  }
}
