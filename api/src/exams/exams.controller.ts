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
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ClinicRoles } from "../common/decorators/roles.decorator";
import { ClinicUserRole } from "../clinic-users/entities/clinic-user.entity";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { ExamsService } from "./exams.service";
import {
  CancelExamDto,
  CreateExamDto,
  QueryExamsDto,
  RecordExamResultDto,
  UpdateExamDto,
} from "./dto/exam.dto";
const uuid = new ParseUUIDPipe({ version: "4" });

@Controller("clinics/:clinicId/exams")
@ClinicRoles("clinicId", ClinicUserRole.OPHTHALMOLOGIST)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get("types")
  types(
    @Param("clinicId", uuid) clinic: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.types(clinic, user);
  }

  @Post()
  create(
    @Param("clinicId", uuid) clinic: string,
    @Body() dto: CreateExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.create(clinic, dto, user);
  }

  @Get()
  list(
    @Param("clinicId", uuid) clinic: string,
    @Query() query: QueryExamsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.list(clinic, query, user);
  }

  @Get(":id")
  detail(
    @Param("clinicId", uuid) clinic: string,
    @Param("id", uuid) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.detail(clinic, id, user);
  }

  @Patch(":id")
  update(
    @Param("clinicId", uuid) clinic: string,
    @Param("id", uuid) id: string,
    @Body() dto: UpdateExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.update(clinic, id, dto, user);
  }

  @Patch(":id/result")
  result(
    @Param("clinicId", uuid) clinic: string,
    @Param("id", uuid) id: string,
    @Body() dto: RecordExamResultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.result(clinic, id, dto, user);
  }

  @Patch(":id/complete")
  complete(
    @Param("clinicId", uuid) clinic: string,
    @Param("id", uuid) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.complete(clinic, id, user);
  }

  @Patch(":id/cancel")
  cancel(
    @Param("clinicId", uuid) clinic: string,
    @Param("id", uuid) id: string,
    @Body() dto: CancelExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.cancel(clinic, id, dto, user);
  }
}
