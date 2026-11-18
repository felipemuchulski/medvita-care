import { ForbiddenException } from "@nestjs/common";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";

export function assertSystemAdmin(user: AuthenticatedUser): void {
  if (!user?.isSystemAdmin) {
    throw new ForbiddenException(
      "Acesso restrito a administradores do sistema.",
    );
  }
}

// Only for administrative operations. Clinical services keep local-only checks.
export function assertAdministrativeClinicAccess(
  user: AuthenticatedUser,
  clinicId: string,
  roles: ClinicUserRole[],
): void {
  if (user?.isSystemAdmin) return;
  if (
    !user?.clinicRoles.some(
      (membership) =>
        membership.clinicId === clinicId && roles.includes(membership.role),
    )
  ) {
    throw new ForbiddenException(
      "O usuário não possui permissão nesta clínica.",
    );
  }
}
