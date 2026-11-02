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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get<string>("DB_HOST", "localhost"),
        port: config.get<number>("DB_PORT", 5432),
        username: config.get<string>("DB_USERNAME", "postgres"),
        password: config.get<string>("DB_PASSWORD", ""),
        database: config.get<string>("DB_NAME", "medvita"),
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
    AuthModule,
  ],
})
export class AppModule {}
