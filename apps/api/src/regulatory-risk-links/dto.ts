import { Allow } from 'class-validator';

export class CreateRegulatoryRiskLinkDto {
  @Allow() unitId?: unknown;
  @Allow() requirementId?: unknown;
  @Allow() provenance!: unknown;
  @Allow() rationale!: unknown;
}
