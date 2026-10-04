import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Clinic } from "./entities/clinic.entity";
import { ClinicController } from "./clinics.controller";
import { ClinicService } from "./clinics.service";

@Module({
  imports: [TypeOrmModule.forFeature([Clinic])],
  controllers: [ClinicController],
  providers: [ClinicService],
  exports: [ClinicService],
})
export class ClinicsModule {}
