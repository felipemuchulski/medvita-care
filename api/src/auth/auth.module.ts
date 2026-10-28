import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { UsersModule } from "src/users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HashingModule } from "src/common/hashing/hashing.module";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthSession } from "./entities/auth-session.entity";
import { RevokedToken } from "./entities/revoked-token.entity";
import { AuthorizationGuard } from "./guards/authorization.guard";

@Module({
  imports: [
    UsersModule,
    HashingModule,
    ConfigModule,
    TypeOrmModule.forFeature([AuthSession, RevokedToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: Number(
            configService.get<string>(
              "JWT_ACCESS_EXPIRES_IN_SECONDS",
              configService.get<string>(
                "JWT_EXPIRES_IN_SECONDS",
                configService.get<string>("JWT_TTL", "900"),
              ),
            ),
          ),
          issuer: configService.get<string>("JWT_TOKEN_ISSUER"),
          audience:
            configService.get<string>("JWT_TOKEN_AUDIENCE") ??
            configService.get<string>("JWT_TOKEN_AUDIECE"),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationGuard,
    },
  ],
})
export class AuthModule {}
