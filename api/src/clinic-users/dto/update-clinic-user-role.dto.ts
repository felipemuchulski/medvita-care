import { IsEnum } from "class-validator";
import { ClinicUserRole } from "../entities/clinic-user.entity";

export class UpdateClinicUserRoleDto {
  @IsEnum(ClinicUserRole)
  role!: ClinicUserRole;
}
