import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { MembershipRole } from '@prisma/client';
import { Transform } from 'class-transformer';

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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;
}

export class InvitationTokenDto {
  @IsString()
  @Length(32, 256)
  token!: string;
}

export class UpdateMemberRoleDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}

export class CreateWorkCenterDto {
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @Length(2, 120) city?: string;
}

export class UpdateWorkCenterDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @Length(2, 120) city?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
