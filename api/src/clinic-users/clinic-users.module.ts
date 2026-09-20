import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClinicUser } from "./entities/clinic-user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([ClinicUser])],
  exports: [TypeOrmModule],
})
export class ClinicUsersModule {}
