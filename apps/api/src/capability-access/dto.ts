import { ArrayNotEmpty, ArrayUnique, IsArray, IsString, IsUUID, Length } from 'class-validator';

export class ActivateCapabilityDemoDto {
  @IsUUID()
  assessmentId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 48, { each: true })
  capabilityKeys!: string[];
}
