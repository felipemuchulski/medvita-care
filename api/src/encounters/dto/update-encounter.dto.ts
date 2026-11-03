import { Transform, Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class UpdateEncounterDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  chiefComplaint?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  anamnesis?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  visualAcuityRight?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  visualAcuityLeft?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  intraocularPressureRight?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  intraocularPressureLeft?: number | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  clinicalAssessment?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  plan?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  clinicalNotes?: string | null;
}
