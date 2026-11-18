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
import { IS_PUBLIC_KEY } from "src/common/decorators/public.decorator";
import { IS_AUTHENTICATED_KEY } from "src/common/decorators/authenticated.decorator";
import { SYSTEM_ADMIN_OR_CLINIC_ROLES_KEY } from "src/common/decorators/system-admin-or-clinic-roles.decorator";

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    const requiresAuthentication = this.reflector.getAllAndOverride<boolean>(
      IS_AUTHENTICATED_KEY,
      targets,
    );
    const requiresSystemAdmin = this.reflector.getAllAndOverride<boolean>(
      SYSTEM_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredRoles = this.reflector.getAllAndOverride<ClinicUserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const hasRolePolicy = requiredRoles !== undefined;
    const allowsSystemAdmin = this.reflector.get<boolean>(
      SYSTEM_ADMIN_OR_CLINIC_ROLES_KEY,
      context.getHandler(),
    );
    if (
      (allowsSystemAdmin && (!hasRolePolicy || requiresSystemAdmin)) ||
      (hasRolePolicy && !requiredRoles?.length) ||
      (isPublic &&
        (requiresAuthentication || requiresSystemAdmin || hasRolePolicy))
    ) {
      throw new ForbiddenException("Política de autorização inválida.");
    }

    if (isPublic) {
      return true;
    }

    if (!requiresAuthentication && !requiresSystemAdmin && !hasRolePolicy) {
      throw new ForbiddenException("Política de autorização não declarada.");
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Usuário não autenticado.");
    }

    if (!requiresSystemAdmin && !hasRolePolicy) return true;

    if (requiresSystemAdmin) {
      if (!user.isSystemAdmin) {
        throw new ForbiddenException(
          "Acesso restrito a administradores do sistema.",
        );
      }
      if (!hasRolePolicy) return true;
    }

    if (allowsSystemAdmin && user.isSystemAdmin) return true;

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
