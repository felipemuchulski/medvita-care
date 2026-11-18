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
import { AppointmentsService } from "./appointments.service";
import { CancelAppointmentDto } from "./dto/cancel-appointment.dto";
import { CheckAvailabilityQueryDto } from "./dto/check-availability-query.dto";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { ListAppointmentsQueryDto } from "./dto/list-appointments-query.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";

const uuidPipe = new ParseUUIDPipe({ version: "4" });

@Controller("clinics/:clinicId/appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @ClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.RECEPTIONIST,
    ClinicUserRole.OPHTHALMOLOGIST,
  )
  create(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.create(clinicId, dto, currentUser);
  }

  @Get()
  @ClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.RECEPTIONIST,
    ClinicUserRole.OPHTHALMOLOGIST,
  )
  findAll(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Query() query: ListAppointmentsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.findAll(clinicId, query, currentUser);
  }

  @Get("availability")
  @ClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.RECEPTIONIST,
    ClinicUserRole.OPHTHALMOLOGIST,
  )
  checkAvailability(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Query() query: CheckAvailabilityQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.checkAvailability(
      clinicId,
      query,
      currentUser,
    );
  }

  @Get(":id")
  @ClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.RECEPTIONIST,
    ClinicUserRole.OPHTHALMOLOGIST,
  )
  findById(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("id", uuidPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.findById(clinicId, id, currentUser);
  }

  @Patch(":id/reschedule")
  @ClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.RECEPTIONIST,
    ClinicUserRole.OPHTHALMOLOGIST,
  )
  reschedule(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("id", uuidPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.reschedule(clinicId, id, dto, currentUser);
  }

  @Patch(":id/cancel")
  @ClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.RECEPTIONIST,
    ClinicUserRole.OPHTHALMOLOGIST,
  )
  cancel(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("id", uuidPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.cancel(clinicId, id, dto, currentUser);
  }
}
