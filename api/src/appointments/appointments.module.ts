import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Appointment } from "./entities/appointment.entity";
import { AuditModule } from "src/audit/audit.module";
import { PatientsModule } from "src/patients/patients.module";
import { ProfessionalsModule } from "src/professionals/professionals.module";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    PatientsModule,
    ProfessionalsModule,
    AuditModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService, TypeOrmModule],
})
export class AppointmentsModule {}
