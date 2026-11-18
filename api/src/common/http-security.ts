import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { isIP } from "net";

function trustedProxies(config: ConfigService): string[] | false {
  const configured = config.get<string>("HTTP_TRUST_PROXY")?.trim();
  if (!configured) return false;

  const proxies = configured.split(",").map((value) => value.trim());
  for (const proxy of proxies) {
    const [address, prefix, extra] = proxy.split("/");
    const version = isIP(address);
    if (
      !version ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) ||
          Number(prefix) < 1 ||
          Number(prefix) > (version === 4 ? 32 : 128)))
    ) {
      throw new Error("HTTP_TRUST_PROXY deve listar IPs ou CIDRs específicos.");
    }
  }
  return proxies;
}

export function configureHttpSecurity(
  app: NestExpressApplication,
  config: ConfigService,
  unified: boolean,
): void {
  app.disable("x-powered-by");
  // Never trust forwarded HTTPS by default or by an unrestricted hop count.
  app.set("trust proxy", trustedProxies(config));
  const production = config.get<string>("NODE_ENV") === "production";
  const reportOnlyPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    production ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
    "form-action 'self'",
  ].join("; ");

  // Register before CORS, static assets and guards so errors/preflights inherit it.
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    response.setHeader("Content-Security-Policy-Report-Only", reportOnlyPolicy);
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    if (production && request.secure) {
      // Conservative rollout; do not include subdomains or opt into preload.
      response.setHeader("Strict-Transport-Security", "max-age=86400");
    }

    // Separate mode serves only the API. Unified mode also serves public React
    // assets: keep their cache behavior, protecting the complete API namespace.
    if (
      !unified ||
      /^\/api(?:\/|$)/i.test(request.path) ||
      request.headers.authorization !== undefined
    ) {
      response.setHeader("Cache-Control", "no-store");
    }
    next();
  });
}
