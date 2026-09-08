import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { OrganizationContext } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { ManagementIntelligenceQueryDto } from './dto';
import { ManagementIntelligenceService } from './management-intelligence.service';
@ApiTags('management-intelligence')
@ApiBearerAuth()
@Controller('management-intelligence')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class ManagementIntelligenceController {
  constructor(private readonly service: ManagementIntelligenceService) {}
  @Get('summary') summary(
    @OrganizationContext() organization: { id: string },
    @Query() query: ManagementIntelligenceQueryDto,
  ) {
    return this.service.summary(organization.id, query);
  }
}
