import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { OrganizationContext } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { OperationalSearchQueryDto } from './dto';
import { OperationalSearchService } from './operational-search.service';

@ApiTags('operational-search')
@ApiBearerAuth()
@Controller('operational-search')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class OperationalSearchController {
  constructor(private readonly service: OperationalSearchService) {}
  @Get() search(
    @OrganizationContext() organization: { id: string },
    @Query() query: OperationalSearchQueryDto,
  ) {
    return this.service.search(organization.id, query);
  }
}
