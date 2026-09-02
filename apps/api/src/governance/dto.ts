import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ActionPriority,
  GovernanceActionStatus,
  GovernanceBodyCategory,
  GovernanceEvidenceType,
  GovernanceMeetingMode,
  GovernanceMeetingStatus,
} from '@prisma/client';

export class CreateGovernanceBodyDto {
  @IsString() @Length(3, 200) name!: string;
  @IsEnum(GovernanceBodyCategory) category!: GovernanceBodyCategory;
  @IsOptional() @IsUUID() workCenterId?: string;
}

export class AddGovernanceMemberDto {
  @IsOptional() @IsUUID() workerId?: string;
  @IsOptional() @IsUUID() membershipId?: string;
  @IsOptional() @IsString() @Length(2, 160) roleLabel?: string;
}

export class GovernanceAgendaItemDto {
  @IsString() @Length(3, 240) title!: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
  @IsInt() @Min(1) @Max(100) sortOrder!: number;
}

export class CreateGovernanceMeetingDto {
  @IsString() @Length(3, 240) title!: string;
  @IsDateString() scheduledAt!: string;
  @IsEnum(GovernanceMeetingMode) mode!: GovernanceMeetingMode;
  @IsOptional() @IsString() @Length(2, 300) location?: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
  @IsOptional() @IsUUID() chairMembershipId?: string;
  @IsOptional() @IsUUID() secretaryMembershipId?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  participantMemberIds: string[] = [];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GovernanceAgendaItemDto)
  agendaItems: GovernanceAgendaItemDto[] = [];
}

export class TransitionGovernanceMeetingDto {
  @IsEnum(GovernanceMeetingStatus) status!: GovernanceMeetingStatus;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}

export class CreateGovernanceDecisionDto {
  @IsOptional() @IsUUID() agendaItemId?: string;
  @IsString() @Length(3, 2000) summary!: string;
  @IsOptional() @IsString() @Length(3, 2000) rationale?: string;
  @IsOptional() @IsUUID() regulatoryUnitId?: string;
  @IsOptional() @IsUUID() requirementId?: string;
}

export class CreateGovernanceActionDto {
  @IsString() @Length(3, 240) title!: string;
  @IsOptional() @IsString() @Length(3, 2000) description?: string;
  @IsOptional() @IsEnum(ActionPriority) priority: ActionPriority = ActionPriority.MEDIUM;
  @IsOptional() @IsUUID() assignedToMembershipId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class TransitionGovernanceActionDto {
  @IsEnum(GovernanceActionStatus) status!: GovernanceActionStatus;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CreateGovernanceEvidenceDto {
  @IsEnum(GovernanceEvidenceType) type!: GovernanceEvidenceType;
  @IsOptional() @IsString() @Length(1, 2000) note?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Length(8, 1000)
  externalUrl?: string;
}
