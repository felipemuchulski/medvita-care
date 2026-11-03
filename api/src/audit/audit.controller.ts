import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { ClinicRoles } from "src/common/decorators/roles.decorator";
import { AuditService } from "./audit.service";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

@Controller("clinics/:clinicId/audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ClinicRoles("clinicId", ClinicUserRole.ADMIN)
  findAll(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Query() query: ListAuditLogsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.auditService.findAll(clinicId, query, currentUser);
  }
}
