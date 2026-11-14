import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { X509Certificate } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { checkServerIdentity, type ConnectionOptions } from "tls";

export function connectionOptions(
  environment: Record<string, unknown>,
): PostgresConnectionOptions {
  const text = (key: string, fallback = ""): string => {
    const value = environment[key];
    return typeof value === "string" && value ? value : fallback;
  };
  let url = text("DATABASE_URL");
  if (url) {
    try {
      const parsed = new URL(url);
      if (
        !["postgres:", "postgresql:"].includes(parsed.protocol) ||
        !parsed.hostname ||
        !parsed.username ||
        !parsed.password ||
        parsed.pathname.length < 2
      )
        throw new Error();
      // pg replaces the ssl object when these URL parameters are present.
      // TLS is configured exclusively below, for both NestJS and the CLI.
      for (const key of [...parsed.searchParams.keys()]) {
        if (/^ssl/i.test(key) || key.toLowerCase() === "uselibpqcompat") {
          parsed.searchParams.delete(key);
        }
      }
      url = parsed.toString();
    } catch {
      throw new Error(
        "DATABASE_URL deve conter uma conexão PostgreSQL válida com usuário, senha e banco.",
      );
    }
  }

  const caPath = text("DB_SSL_CA_PATH").trim();
  if (!caPath) {
    throw new Error(
      "DB_SSL_CA_PATH deve indicar o arquivo PEM do certificado CA.",
    );
  }

  let ca: string;
  try {
    // Both src/database and dist/database are two levels below the API root.
    ca = readFileSync(resolve(__dirname, "../..", caPath), "utf8");
    if (!ca.includes("-----BEGIN CERTIFICATE-----")) throw new Error();
    new X509Certificate(ca);
  } catch {
    // Do not include paths, certificate contents or connection credentials.
    throw new Error(
      "Não foi possível carregar um certificado CA PEM válido de DB_SSL_CA_PATH.",
    );
  }

  const ssl = {
    ca,
    rejectUnauthorized: true,
    checkServerIdentity,
    minVersion: "TLSv1.2",
  } satisfies ConnectionOptions;

  return {
    type: "postgres",
    ...(url
      ? { url: url }
      : {
          host: text("DB_HOST", "localhost"),
          port: Number(environment.DB_PORT || 5432),
          username: text("DB_USERNAME", "medvita_user"),
          password: text("DB_PASSWORD"),
          database: text("DB_NAME", "medvita"),
        }),
    ssl,
    synchronize: false,
    migrationsRun: false,
    installExtensions: false,
  };
}
