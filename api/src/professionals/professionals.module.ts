import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClinicUsersModule } from "src/clinic-users/clinic-users.module";
import { ClinicsModule } from "src/clinics/clinics.module";
import { UsersModule } from "src/users/users.module";
import { ProfessionalProfile } from "./entities/professional-profile.entity";
import { ProfessionalsController } from "./professionals.controller";
import { ProfessionalsService } from "./professionals.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([ProfessionalProfile]),
    ClinicsModule,
    UsersModule,
    ClinicUsersModule,
  ],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService, TypeOrmModule],
})
export class ProfessionalsModule {}
