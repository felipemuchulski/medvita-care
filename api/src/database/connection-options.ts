import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

export function connectionOptions(
  environment: Record<string, unknown>,
): PostgresConnectionOptions {
  const text = (key: string, fallback = ""): string => {
    const value = environment[key];
    return typeof value === "string" && value ? value : fallback;
  };
  const url = text("DATABASE_URL");
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
    } catch {
      throw new Error(
        "DATABASE_URL deve conter uma conexão PostgreSQL válida com usuário, senha e banco.",
      );
    }
  }
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
    synchronize: false,
    migrationsRun: false,
    installExtensions: false,
  };
}
