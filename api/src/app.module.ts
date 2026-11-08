import { ExamsModule } from "./exams/exams.module";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClinicsModule } from "./clinics/clinics.module";
import { UsersModule } from "./users/users.module";
import { ClinicUsersModule } from "./clinic-users/clinic-users.module";
import { ProfessionalsModule } from "./professionals/professionals.module";
import { PatientsModule } from "./patients/patients.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { EncountersModule } from "./encounters/encounters.module";
import { AuthModule } from "./auth/auth.module";
import { validateEnvironment } from "./config/env.validation";
import { AuditModule } from "./audit/audit.module";
import { join } from "path";
import { connectionOptions } from "./database/connection-options";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, "../.env"),
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...connectionOptions(
          Object.fromEntries(
            [
              "DATABASE_URL",
              "DB_HOST",
              "DB_PORT",
              "DB_USERNAME",
              "DB_PASSWORD",
              "DB_NAME",
            ].map((key) => [key, config.get(key)]),
          ),
        ),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    ClinicsModule,
    UsersModule,
    ClinicUsersModule,
    ProfessionalsModule,
    PatientsModule,
    AppointmentsModule,
    EncountersModule,
    ExamsModule,
    AuditModule,
    AuthModule,
  ],
})
export class AppModule {}
