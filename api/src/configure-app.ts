import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { existsSync } from "fs";
import { extname, join, resolve } from "path";

export function configureApplication(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  const unified = config.get<string>("MEDVITA_UNIFIED") === "true";
  const frontendUrl = config.get<string>("FRONTEND_URL")?.trim();
  if (!unified && !frontendUrl)
    throw new Error("FRONTEND_URL não configurada.");
  if (frontendUrl) {
    app.enableCors({
      origin: frontendUrl,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Medvita-Session"],
      credentials: true,
    });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  if (!unified) return;
  app.setGlobalPrefix("api");
  const webRoot = resolve(
    config.get<string>("MEDVITA_WEB_ROOT") || join(__dirname, "../../public"),
  );
  const index = join(webRoot, "index.html");
  if (!existsSync(index) || existsSync(join(webRoot, "api")))
    throw new Error(
      "Build React ausente ou namespace /api reservado. Execute o build unificado.",
    );
  app.useStaticAssets(webRoot, {
    index: false,
    redirect: false,
    dotfiles: "ignore",
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const path = request.path;
    if (
      !["GET", "HEAD"].includes(request.method) ||
      /^\/api(?:\/|$)/i.test(path) ||
      /^\/assets(?:\/|$)/i.test(path) ||
      path.split("/").some((segment) => segment.startsWith(".")) ||
      extname(path) ||
      !request.accepts("html")
    )
      return next();
    response.setHeader("Cache-Control", "no-cache");
    response.sendFile(index, (error) => {
      if (error) next(error);
    });
  });
}
