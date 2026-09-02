import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class ReviewOperationalSignalDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(3, 2000) note?: string;
}
