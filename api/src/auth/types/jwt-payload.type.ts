import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";

export type TokenType = "access" | "refresh";

export type JwtPayload = {
  sub: string;
  sid: string;
  jti: string;
  tokenVersion: number;
  type: TokenType;
  iat?: number;
  exp?: number;
};

export type AuthenticatedClinicRole = {
  clinicId: string;
  role: ClinicUserRole;
};

export type AuthenticatedUser = JwtPayload & {
  name: string;
  email: string;
  isSystemAdmin: boolean;
  clinicRoles: AuthenticatedClinicRole[];
};
