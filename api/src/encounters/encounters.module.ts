import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Encounter } from "./entities/encounter.entity";
import { AppointmentsModule } from "src/appointments/appointments.module";
import { AuditModule } from "src/audit/audit.module";
import { EncountersController } from "./encounters.controller";
import { EncountersService } from "./encounters.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Encounter]),
    AppointmentsModule,
    AuditModule,
  ],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService, TypeOrmModule],
})
export class EncountersModule {}
