import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { OrganizationContext, Roles } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { RolesGuard } from '../organizations/roles.guard';
import { CreateRegulatoryRiskLinkDto } from './dto';
import { RegulatoryRiskLinkService } from './regulatory-risk-link.service';

type OrgContext = { id: string; role: string };
const LINK_WRITE_ROLES = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'SST_MANAGER',
  'SST_TECHNICIAN',
  'CONSULTANT',
] as const;

@ApiTags('regulatory-risk-links')
@ApiBearerAuth()
@Controller('regulatory-risk-links')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class RegulatoryRiskLinkController {
  constructor(private readonly links: RegulatoryRiskLinkService) {}

  @Post('inspection-findings/:findingId')
  @Roles(...LINK_WRITE_ROLES)
  @UseGuards(RolesGuard)
  linkFinding(
    @OrganizationContext() organization: OrgContext,
    @Param('findingId') findingId: string,
    @Body() input: CreateRegulatoryRiskLinkDto,
  ) {
    return this.links.linkFinding(organization.id, findingId, input);
  }

  @Post('technical-assessments/:assessmentId')
  @Roles(...LINK_WRITE_ROLES)
  @UseGuards(RolesGuard)
  linkTechnicalAssessment(
    @OrganizationContext() organization: OrgContext,
    @Param('assessmentId') assessmentId: string,
    @Body() input: CreateRegulatoryRiskLinkDto,
  ) {
    return this.links.linkTechnicalAssessment(organization.id, assessmentId, input);
  }
}
