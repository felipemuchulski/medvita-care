import { applyDecorators, SetMetadata } from "@nestjs/common";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { ClinicRoles } from "./roles.decorator";

export const SYSTEM_ADMIN_OR_CLINIC_ROLES_KEY = "systemAdminOrClinicRoles";

// Opt-in on a specific administrative endpoint, never a controller-wide bypass.
export const SystemAdminOrClinicRoles = (
  clinicIdParam: string,
  ...roles: ClinicUserRole[]
): MethodDecorator =>
  applyDecorators(
    ClinicRoles(clinicIdParam, ...roles),
    SetMetadata(SYSTEM_ADMIN_OR_CLINIC_ROLES_KEY, true),
  );
