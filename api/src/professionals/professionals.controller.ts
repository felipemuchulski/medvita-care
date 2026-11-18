import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { SystemAdminOrClinicRoles } from "src/common/decorators/system-admin-or-clinic-roles.decorator";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { CreateProfessionalDto } from "./dto/create-professional.dto";
import { UpdateProfessionalDto } from "./dto/update-professional.dto";
import { ProfessionalsService } from "./professionals.service";

@Controller("clinics/:clinicId/professionals")
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Post()
  @SystemAdminOrClinicRoles("clinicId", ClinicUserRole.ADMIN)
  create(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateProfessionalDto,
  ) {
    return this.professionalsService.create(clinicId, dto, currentUser);
  }

  @Get()
  @SystemAdminOrClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findByClinic(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.professionalsService.findByClinic(clinicId, currentUser);
  }

  @Get("user/:userId")
  @SystemAdminOrClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findByUser(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Param("userId", new ParseUUIDPipe({ version: "4" })) userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.professionalsService.findByUser(clinicId, userId, currentUser);
  }

  @Get("crm/:crm/:crmState")
  @SystemAdminOrClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findByCrm(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Param("crm") crm: string,
    @Param("crmState") crmState: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.professionalsService.findByCrm(
      clinicId,
      crm,
      crmState,
      currentUser,
    );
  }

  @Get(":id")
  @SystemAdminOrClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findById(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.professionalsService.findById(clinicId, id, currentUser);
  }

  @Patch(":id")
  @SystemAdminOrClinicRoles("clinicId", ClinicUserRole.ADMIN)
  update(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateProfessionalDto,
  ) {
    return this.professionalsService.update(clinicId, id, dto, currentUser);
  }
}
