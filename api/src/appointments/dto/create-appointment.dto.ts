import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateAppointmentDto {
  @IsUUID("4")
  patientId: string;

  @IsUUID("4")
  professionalId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/, {
    message: "scheduledAt deve ser ISO 8601 e informar o fuso horário",
  })
  scheduledAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number = 30;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
