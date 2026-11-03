import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { ClinicRoles } from "src/common/decorators/roles.decorator";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { ListPatientsQueryDto } from "./dto/list-patients-query.dto";
import { UpdatePatientActiveDto } from "./dto/update-patient-active.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { PatientsService } from "./patients.service";

@Controller("clinics/:clinicId/patients")
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @ClinicRoles("clinicId", ClinicUserRole.ADMIN, ClinicUserRole.RECEPTIONIST)
  create(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Body() dto: CreatePatientDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.patientsService.create(clinicId, dto, currentUser);
  }

  @Get()
  @ClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findAll(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Query() query: ListPatientsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.patientsService.findAllByClinic(clinicId, query, currentUser);
  }

  @Get(":id")
  @ClinicRoles(
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
    return this.patientsService.findById(clinicId, id, currentUser);
  }

  @Patch(":id")
  @ClinicRoles("clinicId", ClinicUserRole.ADMIN, ClinicUserRole.RECEPTIONIST)
  update(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.patientsService.update(clinicId, id, dto, currentUser);
  }

  @Patch(":id/active")
  @ClinicRoles("clinicId", ClinicUserRole.ADMIN)
  updateActive(
    @Param("clinicId", new ParseUUIDPipe({ version: "4" })) clinicId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePatientActiveDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.patientsService.updateActive(clinicId, id, dto, currentUser);
  }
}
