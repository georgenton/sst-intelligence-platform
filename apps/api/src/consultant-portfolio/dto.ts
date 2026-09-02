import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import {
  PORTFOLIO_ATTENTION_STATES,
  PORTFOLIO_DUE_STATES,
  PORTFOLIO_SIGNAL_TYPES,
  PORTFOLIO_WORK_TYPES,
  type PortfolioQuery,
  type PortfolioDueState,
  type PortfolioWorkType,
} from '@sst/contracts';

export class PortfolioQueryDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @IsIn(PORTFOLIO_ATTENTION_STATES) attention: PortfolioQuery['attention'] = 'ALL';
  @IsOptional() @IsIn(PORTFOLIO_WORK_TYPES) workType?: PortfolioWorkType;
  @IsOptional() @IsIn(PORTFOLIO_DUE_STATES) dueState: PortfolioDueState = 'ALL';
  @IsOptional() @IsIn(PORTFOLIO_SIGNAL_TYPES) signalType?: (typeof PORTFOLIO_SIGNAL_TYPES)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class PortfolioCopilotRequestDto {
  @IsString() @Length(1, 4_000) content!: string;
  @IsOptional() @IsUUID() organizationId?: string;
}
