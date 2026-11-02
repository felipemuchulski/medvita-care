import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClinicUser } from "./entities/clinic-user.entity";
import { ClinicUsersController } from "./clinic-users.controller";
import { ClinicUsersService } from "./clinic-users.service";
import { ClinicsModule } from "src/clinics/clinics.module";
import { UsersModule } from "src/users/users.module";

@Module({
  imports: [TypeOrmModule.forFeature([ClinicUser]), ClinicsModule, UsersModule],
  controllers: [ClinicUsersController],
  providers: [ClinicUsersService],
  exports: [ClinicUsersService, TypeOrmModule],
})
export class ClinicUsersModule {}
