import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";

export class CheckAvailabilityQueryDto {
  @IsUUID("4")
  professionalId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/, {
    message: "Informe uma data e horário válidos para o agendamento.",
  })
  scheduledAt: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes: number;

  @IsOptional()
  @IsUUID("4")
  excludeAppointmentId?: string;
}
