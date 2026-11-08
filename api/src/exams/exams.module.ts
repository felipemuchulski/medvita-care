import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "../audit/audit.module";
import { Exam } from "./entities/exam.entity";
import { ExamType } from "./entities/exam-type.entity";
import { ExamsController } from "./exams.controller";
import { ExamsService } from "./exams.service";

@Module({
  imports: [TypeOrmModule.forFeature([Exam, ExamType]), AuditModule],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
