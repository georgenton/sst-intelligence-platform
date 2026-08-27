import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { OrganizationContext } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { WorkQueueQueryDto } from './dto';
import { WorkQueueService } from './work-queue.service';

@ApiTags('work-queue')
@ApiBearerAuth()
@Controller('work-queue')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class WorkQueueController {
  constructor(private readonly queue: WorkQueueService) {}

  @Get()
  list(@OrganizationContext() organization: { id: string }, @Query() query: WorkQueueQueryDto) {
    return this.queue.list(organization.id, query);
  }
}
