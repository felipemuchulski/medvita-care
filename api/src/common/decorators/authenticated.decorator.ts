import { SetMetadata } from "@nestjs/common";

export const IS_AUTHENTICATED_KEY = "requiresAuthentication";

// JWT is enforced by JwtAuthGuard; identity/ownership checks remain in handlers.
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
