import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClinicsModule } from "src/clinics/clinics.module";
import { Patient } from "./entities/patient.entity";
import { PatientsController } from "./patients.controller";
import { PatientsService } from "./patients.service";
import { AuditModule } from "src/audit/audit.module";

@Module({
  imports: [TypeOrmModule.forFeature([Patient]), ClinicsModule, AuditModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService, TypeOrmModule],
})
export class PatientsModule {}
