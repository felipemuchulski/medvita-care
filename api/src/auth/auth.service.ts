import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { IsNull, Repository } from "typeorm";
import { HashingService } from "src/common/hashing/hashing.service";
import { User } from "src/users/entities/user.entity";
import { UserService } from "src/users/user.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthSession } from "./entities/auth-session.entity";
import { RevokedToken } from "./entities/revoked-token.entity";
import { AuthenticatedClinicRole, JwtPayload } from "./types/jwt-payload.type";

@Injectable()
export class AuthService {
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;
  private readonly refreshTokenSecret: string;
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor(
    private readonly userService: UserService,
    private readonly hashingService: HashingService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(AuthSession)
    private readonly sessionsRepository: Repository<AuthSession>,
    @InjectRepository(RevokedToken)
    private readonly revokedTokensRepository: Repository<RevokedToken>,
  ) {
    this.accessTokenTtl = this.getNumberConfig(
      "JWT_ACCESS_EXPIRES_IN_SECONDS",
      this.getNumberConfig(
        "JWT_EXPIRES_IN_SECONDS",
        this.getNumberConfig("JWT_TTL", 900),
      ),
    );
    this.refreshTokenTtl = this.getNumberConfig(
      "JWT_REFRESH_EXPIRES_IN_SECONDS",
      604800,
    );
    const accessTokenSecret =
      this.configService.getOrThrow<string>("JWT_SECRET");
    const configuredRefreshSecret =
      this.configService.get<string>("JWT_REFRESH_SECRET");

    if (
      this.configService.get<string>("NODE_ENV") === "production" &&
      (!configuredRefreshSecret ||
        configuredRefreshSecret === accessTokenSecret)
    ) {
      throw new Error(
        "JWT_REFRESH_SECRET deve ser definido e diferente de JWT_SECRET em produção.",
      );
    }

    this.refreshTokenSecret = configuredRefreshSecret ?? accessTokenSecret;
    this.issuer = this.configService.get<string>("JWT_TOKEN_ISSUER");
    this.audience =
      this.configService.get<string>("JWT_TOKEN_AUDIENCE") ??
      this.configService.get<string>("JWT_TOKEN_AUDIECE");
  }

  async login(loginDto: LoginDto) {
    const user = await this.findUserByEmail(loginDto.email);

    if (!user.active) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    const passwordIsValid = await this.hashingService.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    const authenticatedUser = await this.userService.findForAuthentication(
      user.id,
    );
    const sessionId = randomUUID();
    const tokens = await this.issueTokenPair(authenticatedUser, sessionId);

    await this.sessionsRepository.save(
      this.sessionsRepository.create({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(tokens.refreshToken),
        refreshTokenJti: tokens.refreshTokenJti,
        expiresAt: tokens.refreshTokenExpiresAt,
        revokedAt: null,
      }),
    );

    return this.buildAuthResponse(authenticatedUser, tokens);
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.sessionsRepository.findOneBy({
      id: payload.sid,
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.refreshTokenJti !== payload.jti
    ) {
      throw new UnauthorizedException("Refresh token inválido ou revogado.");
    }

    const refreshTokenMatches = this.refreshTokenMatches(
      dto.refreshToken,
      session.refreshTokenHash,
    );

    if (!refreshTokenMatches) {
      session.revokedAt = new Date();
      await this.sessionsRepository.save(session);
      throw new UnauthorizedException("Refresh token inválido ou revogado.");
    }

    const user = await this.getActiveUser(payload.sub, payload.tokenVersion);
    const tokens = await this.issueTokenPair(user, session.id);

    session.refreshTokenHash = this.hashRefreshToken(tokens.refreshToken);
    session.refreshTokenJti = tokens.refreshTokenJti;
    session.expiresAt = tokens.refreshTokenExpiresAt;
    await this.sessionsRepository.save(session);

    return this.buildAuthResponse(user, tokens);
  }

  async logout(user: JwtPayload) {
    await this.sessionsRepository.update(
      { id: user.sid, userId: user.sub, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    const expiresAt = new Date(
      (user.exp ?? Math.floor(Date.now() / 1000) + this.accessTokenTtl) * 1000,
    );

    await this.revokedTokensRepository.upsert(
      {
        jti: user.jti,
        userId: user.sub,
        reason: "logout",
        expiresAt,
      },
      ["jti"],
    );

    return { message: "Logout realizado com sucesso." };
  }

  async changePassword(userId: string, changePassword: ChangePasswordDto) {
    const user = await this.userService.findById(userId);

    const passwordIsValid = await this.hashingService.compare(
      changePassword.currentPassword,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException("Usuário ou senha incorretos.");
    }

    const hashedPassword = await this.hashingService.hash(
      changePassword.newPassword,
    );

    await this.userService.updatePassword(user.id, hashedPassword);
    await this.sessionsRepository.update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    return { message: "Senha alterada com sucesso. Faça login novamente." };
  }

  private async issueTokenPair(user: User, sessionId: string) {
    const accessTokenJti = randomUUID();
    const refreshTokenJti = randomUUID();
    const basePayload = {
      sub: user.id,
      sid: sessionId,
      tokenVersion: user.tokenVersion,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({
        ...basePayload,
        jti: accessTokenJti,
        type: "access",
      } satisfies JwtPayload),
      this.jwtService.signAsync(
        {
          ...basePayload,
          jti: refreshTokenJti,
          type: "refresh",
        } satisfies JwtPayload,
        {
          secret: this.refreshTokenSecret,
          expiresIn: this.refreshTokenTtl,
          issuer: this.issuer,
          audience: this.audience,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenJti,
      refreshTokenJti,
      refreshTokenExpiresAt: new Date(Date.now() + this.refreshTokenTtl * 1000),
    };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.refreshTokenSecret,
        issuer: this.issuer,
        audience: this.audience,
      });

      if (payload.type !== "refresh") {
        throw new UnauthorizedException();
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Refresh token inválido ou expirado.");
    }
  }

  private async getActiveUser(
    userId: string,
    tokenVersion: number,
  ): Promise<User> {
    try {
      const user = await this.userService.findForAuthentication(userId);

      if (!user.active || user.tokenVersion !== tokenVersion) {
        throw new UnauthorizedException();
      }

      return user;
    } catch {
      throw new UnauthorizedException("Usuário ou sessão inválidos.");
    }
  }

  private buildAuthResponse(
    user: User,
    tokens: Awaited<ReturnType<AuthService["issueTokenPair"]>>,
  ) {
    const clinicRoles: AuthenticatedClinicRole[] = (user.clinicUsers ?? [])
      .filter((membership) => membership.active && membership.clinic?.active)
      .map((membership) => ({
        clinicId: membership.clinicId,
        role: membership.role,
      }));

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: "Bearer",
      expiresIn: this.accessTokenTtl,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSystemAdmin: user.isSystemAdmin,
        clinicRoles,
      },
    };
  }

  private async findUserByEmail(email: string): Promise<User> {
    try {
      return await this.userService.findByEmail(email);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException("E-mail ou senha inválidos.");
      }

      throw error;
    }
  }

  private getNumberConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key, String(fallback)));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshTokenMatches(token: string, expectedHash: string): boolean {
    const actualHash = Buffer.from(this.hashRefreshToken(token), "hex");
    const storedHash = Buffer.from(expectedHash, "hex");

    return (
      actualHash.length === storedHash.length &&
      timingSafeEqual(actualHash, storedHash)
    );
  }
}
