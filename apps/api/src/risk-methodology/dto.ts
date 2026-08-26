import { Allow } from 'class-validator';

export class SaveOrganizationRiskMethodPolicyDto {
  @Allow() allowedRiskMethodVersionIds!: unknown;
  @Allow() defaultRiskMethodVersionId!: unknown;
}

export class SaveOrganizationGuided5x5ProfileDto {
  @Allow() probabilityGuidance!: unknown;
  @Allow() severityGuidance!: unknown;
  @Allow() additionalCriteria!: unknown;
}
