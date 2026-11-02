type Environment = Record<string, unknown>;

const requiredVariables = [
  "DB_HOST",
  "DB_USERNAME",
  "DB_NAME",
  "JWT_SECRET",
] as const;

function validatePositiveInteger(
  environment: Environment,
  key: string,
  fallback?: number,
) {
  const rawValue = environment[key];

  if ((rawValue === undefined || rawValue === "") && fallback !== undefined) {
    environment[key] = fallback;
    return;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} deve ser um número inteiro positivo.`);
  }

  environment[key] = value;
}

export function validateEnvironment(environment: Environment): Environment {
  for (const key of requiredVariables) {
    const value = environment[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${key} deve ser informado.`);
    }
  }

  const nodeEnv = (
    typeof environment.NODE_ENV === "string"
      ? environment.NODE_ENV
      : "development"
  ).toLowerCase();
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV deve ser development, test ou production.");
  }

  environment.NODE_ENV = nodeEnv;
  validatePositiveInteger(environment, "PORT", 3000);
  validatePositiveInteger(environment, "DB_PORT", 5432);
  if (
    environment.JWT_ACCESS_EXPIRES_IN_SECONDS === undefined ||
    environment.JWT_ACCESS_EXPIRES_IN_SECONDS === ""
  ) {
    environment.JWT_ACCESS_EXPIRES_IN_SECONDS =
      environment.JWT_EXPIRES_IN_SECONDS ?? environment.JWT_TTL ?? 900;
  }

  validatePositiveInteger(environment, "JWT_ACCESS_EXPIRES_IN_SECONDS");
  validatePositiveInteger(
    environment,
    "JWT_REFRESH_EXPIRES_IN_SECONDS",
    604800,
  );

  const accessSecret =
    typeof environment.JWT_SECRET === "string" ? environment.JWT_SECRET : "";
  const refreshSecret = environment.JWT_REFRESH_SECRET;

  if (
    nodeEnv === "production" &&
    (typeof refreshSecret !== "string" ||
      !refreshSecret.trim() ||
      refreshSecret === accessSecret)
  ) {
    throw new Error(
      "JWT_REFRESH_SECRET deve ser informado e diferente de JWT_SECRET em produção.",
    );
  }

  return environment;
}
