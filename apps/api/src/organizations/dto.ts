import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { MembershipRole } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(2, 80)
  country!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  sector?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  sector?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
