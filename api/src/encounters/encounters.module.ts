import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Encounter } from "./entities/encounter.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Encounter])],
  exports: [TypeOrmModule],
})
export class EncountersModule {}
