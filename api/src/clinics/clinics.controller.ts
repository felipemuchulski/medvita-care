import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ClinicService } from "./clinics.service";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { UpdateClinicDto } from "./dto/update-clinic.dto";
import { UpdateActiveDto } from "./dto/update-active.dto";
import { SystemAdmin } from "src/common/decorators/system-admin.decorator";
import { SystemAdminOrClinicRoles } from "src/common/decorators/system-admin-or-clinic-roles.decorator";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";

@Controller("clinics")
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  @Post()
  @SystemAdmin()
  create(
    @Body() createClinicDto: CreateClinicDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicService.create(createClinicDto, user);
  }

  @Get()
  @SystemAdmin()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.clinicService.findAll(user);
  }

  @Get("document/:document")
  @SystemAdmin()
  findByDocument(
    @Param("document") document: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicService.findByDocument(document, user);
  }

  @Get(":id")
  @SystemAdminOrClinicRoles(
    "id",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicService.findByIdForUser(id, user);
  }

  @Patch(":id")
  @SystemAdminOrClinicRoles("id", ClinicUserRole.ADMIN)
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateClinicDto: UpdateClinicDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicService.updateClinic(id, updateClinicDto, user);
  }

  @Patch(":id/active")
  @SystemAdmin()
  updateActive(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateActiveDto: UpdateActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicService.updateActive(id, updateActiveDto, user);
  }
}
