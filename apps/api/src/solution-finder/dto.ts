import { IsInt, IsObject, Max, Min } from 'class-validator';

export class UpdateSessionDto {
  @IsObject()
  answers!: Record<string, unknown>;

  @IsInt()
  @Min(1)
  @Max(6)
  currentStep!: number;
}
