import { IsEnum, IsUUID } from "class-validator";
import { ClinicUserRole } from "../entities/clinic-user.entity";

export class CreateClinicUserDto {
  @IsUUID("4")
  userId!: string;

  @IsEnum(ClinicUserRole)
  role!: ClinicUserRole;
}
