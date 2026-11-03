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
import { CancelEncounterDto } from "./dto/cancel-encounter.dto";
import { ListEncountersQueryDto } from "./dto/list-encounters-query.dto";
import { StartEncounterDto } from "./dto/start-encounter.dto";
import { UpdateEncounterDto } from "./dto/update-encounter.dto";
import { EncountersService } from "./encounters.service";

const uuidPipe = new ParseUUIDPipe({ version: "4" });

@Controller("clinics/:clinicId")
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post("encounters")
  @ClinicRoles("clinicId", ClinicUserRole.OPHTHALMOLOGIST)
  start(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Body() dto: StartEncounterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.encountersService.start(clinicId, dto, currentUser);
  }

  @Get("encounters")
  @ClinicRoles("clinicId", ClinicUserRole.OPHTHALMOLOGIST)
  findAll(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Query() query: ListEncountersQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.encountersService.findAll(clinicId, query, currentUser);
  }

  @Get("patients/:patientId/encounters")
  @ClinicRoles("clinicId", ClinicUserRole.OPHTHALMOLOGIST)
  findPatientHistory(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("patientId", uuidPipe) patientId: string,
    @Query() query: ListEncountersQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.encountersService.findPatientHistory(
      clinicId,
      patientId,
      query,
      currentUser,
    );
  }

  @Get("encounters/:id")
  @ClinicRoles("clinicId", ClinicUserRole.OPHTHALMOLOGIST)
  findById(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("id", uuidPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.encountersService.findById(clinicId, id, currentUser);
  }

  @Patch("encounters/:id")
  @ClinicRoles("clinicId", ClinicUserRole.OPHTHALMOLOGIST)
  update(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("id", uuidPipe) id: string,
    @Body() dto: UpdateEncounterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.encountersService.update(clinicId, id, dto, currentUser);
  }

  @Patch("encounters/:id/complete")
  @ClinicRoles("clinicId", ClinicUserRole.OPHTHALMOLOGIST)
  complete(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("id", uuidPipe) id: string,
    @Body() dto: UpdateEncounterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.encountersService.complete(clinicId, id, dto, currentUser);
  }

  @Patch("encounters/:id/cancel")
  @ClinicRoles("clinicId", ClinicUserRole.OPHTHALMOLOGIST)
  cancel(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("id", uuidPipe) id: string,
    @Body() dto: CancelEncounterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.encountersService.cancel(clinicId, id, dto, currentUser);
  }
}
