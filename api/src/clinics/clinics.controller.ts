import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ClinicService } from "./clinics.service";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { UpdateClinicDto } from "./dto/update-clinic.dto";
import { UpdateActiveDto } from "./dto/update-active.dto";
import { SystemAdmin } from "src/common/decorators/system-admin.decorator";
import { ClinicRoles } from "src/common/decorators/roles.decorator";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";

@Controller("clinics")
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  @Post()
  @SystemAdmin()
  create(@Body() createClinicDto: CreateClinicDto) {
    return this.clinicService.create(createClinicDto);
  }

  @Get()
  @SystemAdmin()
  findAll() {
    return this.clinicService.findAll();
  }

  @Get("document/:document")
  @SystemAdmin()
  findByDocument(@Param("document") document: string) {
    return this.clinicService.findByDocument(document);
  }

  @Get(":id")
  @ClinicRoles(
    "id",
    ClinicUserRole.ADMIN,
    ClinicUserRole.OPHTHALMOLOGIST,
    ClinicUserRole.RECEPTIONIST,
  )
  findById(@Param("id") id: string) {
    return this.clinicService.findById(id);
  }

  @Patch(":id")
  @ClinicRoles("id", ClinicUserRole.ADMIN)
  update(@Param("id") id: string, @Body() updateClinicDto: UpdateClinicDto) {
    return this.clinicService.updateClinic(id, updateClinicDto);
  }

  @Patch(":id/active")
  @SystemAdmin()
  updateActive(
    @Param("id") id: string,
    @Body() updateActiveDto: UpdateActiveDto,
  ) {
    return this.clinicService.updateActive(id, updateActiveDto);
  }
}
