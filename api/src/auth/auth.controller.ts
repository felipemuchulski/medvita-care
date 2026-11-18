import {
  Body,
  Controller,
  Post,
  Patch,
  Req,
  Res,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "src/common/decorators/public.decorator";
import { Authenticated } from "src/common/decorators/authenticated.decorator";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import type { Request, Response, CookieOptions } from "express";
import { AuthenticatedUser } from "./types/jwt-payload.type";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Public()
  async createLogin(
    @Body() createLoginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.requireBrowserRequest(request);
    response.setHeader("Cache-Control", "no-store");
    return this.sessionResponse(
      await this.authService.login(createLoginDto),
      response,
    );
  }

  @Post("refresh")
  @Public()
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.requireBrowserRequest(request);
    response.setHeader("Cache-Control", "no-store");
    const refreshToken = request.headers.cookie
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("medvita_session="))
      ?.slice("medvita_session=".length);
    try {
      if (!refreshToken)
        throw new UnauthorizedException("Sessão não encontrada.");
      return this.sessionResponse(
        await this.authService.refresh({ refreshToken }),
        response,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        response.clearCookie("medvita_session", this.cookieOptions());
      }
      throw error;
    }
  }

  @Post("logout")
  @Authenticated()
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.requireBrowserRequest(request);
    response.clearCookie("medvita_session", this.cookieOptions());
    return this.authService.logout(user);
  }

  @Patch("change-password")
  @Authenticated()
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword(user.sub, dto);
    response.clearCookie("medvita_session", this.cookieOptions());
    return result;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    };
  }

  private requireBrowserRequest(request: Request) {
    // Custom headers cannot be sent by cross-origin HTML forms. CORS remains disabled.
    if (request.headers["x-medvita-session"] !== "1") {
      throw new ForbiddenException("Cabeçalho de sessão obrigatório.");
    }
  }

  private sessionResponse(
    session: Awaited<ReturnType<AuthService["login"]>>,
    response: Response,
  ) {
    const { refreshToken, ...body } = session;
    // No expires/maxAge: the browser owns the lifetime of this session cookie.
    response.cookie("medvita_session", refreshToken, this.cookieOptions());
    return body;
  }
}
