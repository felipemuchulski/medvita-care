import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ClinicService } from "./clinics.service";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { UpdateClinicDto } from "./dto/update-clinic.dto";
import { UpdateActiveDto } from "./dto/update-active.dto";

@Controller("clinics")
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  @Post()
  create(@Body() createClinicDto: CreateClinicDto) {
    return this.clinicService.create(createClinicDto);
  }

  @Get()
  findAll() {
    return this.clinicService.findAll();
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.clinicService.findById(id);
  }

  @Get("document/:document")
  findByDocument(@Param("document") document: string) {
    return this.clinicService.findByDocument(document);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateClinicDto: UpdateClinicDto) {
    return this.clinicService.updateClinic(id, updateClinicDto);
  }

  @Patch(":id/active")
  updateActive(
    @Param("id") id: string,
    @Body() updateActiveDto: UpdateActiveDto,
  ) {
    return this.clinicService.updateActive(id, updateActiveDto);
  }
}
