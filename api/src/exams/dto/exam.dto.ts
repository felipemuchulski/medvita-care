import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateIf,
} from "class-validator";
import { ExamLaterality, ExamStatus } from "../entities/exam.entity";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateExamDto {
  @IsUUID("4")
  patientId: string;

  @IsUUID("4")
  examTypeId: string;

  @IsOptional()
  @IsUUID("4")
  encounterId?: string;

  @IsEnum(ExamLaterality)
  laterality: ExamLaterality;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateExamDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ExamLaterality)
  laterality?: ExamLaterality;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class RecordExamResultDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  resultText: string;

  @IsDateString({ strict: true })
  @Matches(/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: "performedAt deve incluir horário com segundos e fuso.",
  })
  performedAt: string;
}

export class CancelExamDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class QueryExamsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsUUID("4")
  patientId?: string;

  @IsOptional()
  @IsUUID("4")
  encounterId?: string;

  @IsOptional()
  @IsUUID("4")
  examTypeId?: string;

  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
