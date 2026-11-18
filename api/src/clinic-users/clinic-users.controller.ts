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
import { SystemAdminOrClinicRoles } from "src/common/decorators/system-admin-or-clinic-roles.decorator";
import { Authenticated } from "src/common/decorators/authenticated.decorator";
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
  @SystemAdminOrClinicRoles("clinicId", ClinicUserRole.ADMIN)
  create(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Body() dto: CreateClinicUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.clinicUsersService.create(clinicId, dto, currentUser);
  }

  @Get("clinics/:clinicId/users")
  @SystemAdminOrClinicRoles(
    "clinicId",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findByClinic(
    @Param("clinicId", uuidPipe) clinicId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.clinicUsersService.findByClinic(clinicId, currentUser);
  }

  @Get("users/:userId/clinics")
  @Authenticated()
  findByUser(
    @Param("userId", uuidPipe) userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (currentUser.sub !== userId && !currentUser.isSystemAdmin) {
      throw new ForbiddenException(
        "Você só pode consultar os próprios vínculos com clínicas.",
      );
    }

    return this.clinicUsersService.findByUser(userId, currentUser);
  }

  @Patch("clinics/:clinicId/users/:userId/role")
  @SystemAdminOrClinicRoles("clinicId", ClinicUserRole.ADMIN)
  updateRole(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("userId", uuidPipe) userId: string,
    @Body() dto: UpdateClinicUserRoleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.clinicUsersService.updateRole(
      clinicId,
      userId,
      dto,
      currentUser,
    );
  }

  @Patch("clinics/:clinicId/users/:userId/active")
  @SystemAdminOrClinicRoles("clinicId", ClinicUserRole.ADMIN)
  updateActive(
    @Param("clinicId", uuidPipe) clinicId: string,
    @Param("userId", uuidPipe) userId: string,
    @Body() dto: UpdateClinicUserActiveDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.clinicUsersService.updateActive(
      clinicId,
      userId,
      dto,
      currentUser,
    );
  }
}
