import { SetMetadata, applyDecorators } from "@nestjs/common";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";

export const ROLES_KEY = "clinicRoles";
export const CLINIC_ID_PARAM_KEY = "clinicIdParam";

export const Roles = (...roles: ClinicUserRole[]) =>
  SetMetadata(ROLES_KEY, roles);

export const ClinicRoles = (
  clinicIdParam: string,
  ...roles: ClinicUserRole[]
) =>
  applyDecorators(
    SetMetadata(CLINIC_ID_PARAM_KEY, clinicIdParam),
    Roles(...roles),
  );
