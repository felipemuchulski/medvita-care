import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { ClinicRoles } from "src/common/decorators/roles.decorator";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUsersService } from "./clinic-users.service";
import { CreateClinicUserDto } from "./dto/create-clinic-user.dto";
import { UpdateClinicUserRoleDto } from "./dto/update-clinic-user-role.dto";
import { UpdateClinicUserActiveDto } from "./dto/update-clinic-user-active.dto";
import { ClinicUserRole } from "./entities/clinic-user.entity";

const uuidPipe = new ParseUUIDPipe({ version: "4" });

@Controller()
export class ClinicUsersController {
  constructor(private readonly clinicUsersService: ClinicUsersService) {}

  @Post("clinics/:clinicId/users")
  @ClinicRoles("clinicId", ClinicUserRole.ADMIN)
  create(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Body() dto: CreateClinicUserDto,
  ) {
    return this.clinicUsersService.create(clinicId, dto);
  }

  @Get("clinics/:clinicId/users")
  @ClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findByClinic(@Param("clinicId", uuidPipe) clinicId: string) {
    return this.clinicUsersService.findByClinic(clinicId);
  }

  @Get("users/:userId/clinics")
  findByUser(
    @Param("userId", uuidPipe) userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (currentUser.sub !== userId && !currentUser.isSystemAdmin) {
      throw new ForbiddenException(
        "Você só pode consultar os próprios vínculos com clínicas.",
      );
    }

    return this.clinicUsersService.findByUser(userId);
  }

  @Patch("clinics/:clinicId/users/:userId/role")
  @ClinicRoles("clinicId", ClinicUserRole.ADMIN)
  updateRole(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("userId", uuidPipe) userId: string,
    @Body() dto: UpdateClinicUserRoleDto,
  ) {
    return this.clinicUsersService.updateRole(clinicId, userId, dto);
  }

  @Patch("clinics/:clinicId/users/:userId/active")
  @ClinicRoles("clinicId", ClinicUserRole.ADMIN)
  updateActive(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("userId", uuidPipe) userId: string,
    @Body() dto: UpdateClinicUserActiveDto,
  ) {
    return this.clinicUsersService.updateActive(clinicId, userId, dto);
  }
}
