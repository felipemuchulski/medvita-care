import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthenticatedUser } from "../types/jwt-payload.type";
import { SYSTEM_ADMIN_KEY } from "src/common/decorators/system-admin.decorator";
import {
  CLINIC_ID_PARAM_KEY,
  ROLES_KEY,
} from "src/common/decorators/roles.decorator";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresSystemAdmin = this.reflector.getAllAndOverride<boolean>(
      SYSTEM_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredRoles = this.reflector.getAllAndOverride<ClinicUserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresSystemAdmin && !requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Usuário não autenticado.");
    }

    if (user.isSystemAdmin) {
      return true;
    }

    if (requiresSystemAdmin) {
      throw new ForbiddenException(
        "Acesso restrito a administradores do sistema.",
      );
    }

    const clinicIdParam = this.reflector.getAllAndOverride<string>(
      CLINIC_ID_PARAM_KEY,
      [context.getHandler(), context.getClass()],
    );
    const clinicId = clinicIdParam
      ? request.params[clinicIdParam]
      : request.header("x-clinic-id");

    if (!clinicId) {
      throw new ForbiddenException("O contexto da clínica não foi informado.");
    }

    const hasRequiredRole = user.clinicRoles.some(
      (membership) =>
        membership.clinicId === clinicId &&
        requiredRoles.includes(membership.role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        "O usuário não possui permissão nesta clínica.",
      );
    }

    return true;
  }
}
