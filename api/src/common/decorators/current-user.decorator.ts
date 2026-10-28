import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import type { Request } from "express";

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
