import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponse } from '../../../common/http/decorators/api-standard-response.decorator';
import { env } from '../../../config/env.schema';
import {
  AiResultAcceptedResponseDto,
  AiResultEnvelopeDto,
} from '../dto/ai-result-envelope.dto';
import { AiResultsService } from '../services/ai-results.service';

@ApiTags('AI Results')
@Controller('internal/ai-results')
export class AiResultsController {
  constructor(private readonly aiResultsService: AiResultsService) {}

  @Post()
  @ApiOperation({
    summary: 'Accept AI worker result event',
    operationId: 'acceptAiWorkerResult',
  })
  @ApiStandardResponse({
    description: 'AI result accepted',
    type: AiResultAcceptedResponseDto,
    errors: [400, 403, 404, 500, 'default'],
  })
  accept(
    @Body() dto: AiResultEnvelopeDto,
    @Headers('x-ai-results-secret') secret?: string,
  ) {
    this.assertInternalSecret(secret);
    return this.aiResultsService.processResult(dto);
  }

  private assertInternalSecret(secret?: string): void {
    if (!env.AI_RESULTS_SHARED_SECRET) {
      throw new ServiceUnavailableException({
        code: 'AI_RESULTS_SECRET_NOT_CONFIGURED',
        message: 'AI results shared secret is not configured',
      });
    }

    if (secret === env.AI_RESULTS_SHARED_SECRET) {
      return;
    }

    throw new ForbiddenException({
      code: 'AI_RESULTS_SECRET_INVALID',
      message: 'AI results shared secret is invalid',
    });
  }
}
