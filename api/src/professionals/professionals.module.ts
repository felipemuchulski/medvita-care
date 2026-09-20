import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProfessionalProfile } from "./entities/professional-profile.entity";

@Module({
  imports: [TypeOrmModule.forFeature([ProfessionalProfile])],
  exports: [TypeOrmModule],
})
export class ProfessionalsModule {}
