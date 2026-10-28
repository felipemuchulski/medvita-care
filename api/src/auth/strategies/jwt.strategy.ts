import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { UserService } from "src/users/user.service";
import { User } from "src/users/entities/user.entity";
import { AuthSession } from "../entities/auth-session.entity";
import { RevokedToken } from "../entities/revoked-token.entity";
import { AuthenticatedUser, JwtPayload } from "../types/jwt-payload.type";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
    @InjectRepository(AuthSession)
    private readonly sessionsRepository: Repository<AuthSession>,
    @InjectRepository(RevokedToken)
    private readonly revokedTokensRepository: Repository<RevokedToken>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
      issuer: configService.get<string>("JWT_TOKEN_ISSUER"),
      audience:
        configService.get<string>("JWT_TOKEN_AUDIENCE") ??
        configService.get<string>("JWT_TOKEN_AUDIECE"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Tipo de token inválido.");
    }

    const [session, revokedToken] = await Promise.all([
      this.sessionsRepository.findOneBy({
        id: payload.sid,
        userId: payload.sub,
      }),
      this.revokedTokensRepository.findOneBy({ jti: payload.jti }),
    ]);

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      revokedToken
    ) {
      throw new UnauthorizedException("Sessão inválida ou revogada.");
    }

    let user: User;
    try {
      user = await this.userService.findForAuthentication(payload.sub);
    } catch {
      throw new UnauthorizedException("Usuário não encontrado.");
    }

    if (!user.active || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException("Usuário inativo ou token revogado.");
    }

    return {
      ...payload,
      name: user.name,
      email: user.email,
      isSystemAdmin: user.isSystemAdmin,
      clinicRoles: (user.clinicUsers ?? [])
        .filter((membership) => membership.active && membership.clinic?.active)
        .map((membership) => ({
          clinicId: membership.clinicId,
          role: membership.role,
        })),
    };
  }
}
