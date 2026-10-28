import { SetMetadata } from "@nestjs/common";

export const SYSTEM_ADMIN_KEY = "requiresSystemAdmin";
export const SystemAdmin = () => SetMetadata(SYSTEM_ADMIN_KEY, true);
