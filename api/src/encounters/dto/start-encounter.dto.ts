import { IsUUID } from "class-validator";

export class StartEncounterDto {
  @IsUUID("4")
  appointmentId: string;
}
