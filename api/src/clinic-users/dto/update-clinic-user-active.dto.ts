import { IsBoolean } from "class-validator";

export class UpdateClinicUserActiveDto {
  @IsBoolean()
  active!: boolean;
}
