import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { DataSource, EntityManager } from "typeorm";
import { BcryptService } from "../../common/hashing/bcrypt.service";
import { normalizedEmail } from "../../common/utils/normalize-email.utils";
import { CreateUserDto } from "../../users/dto/create-user.dto";
import { User } from "../../users/entities/user.entity";

export class SystemAdminBootstrapError extends Error {}
export type BootstrapMode = "check" | "create" | "validate";
export type AdminIdentity = { name?: string; email: string; password?: string };
export const PRODUCTION_AUTHORIZATION = "bootstrap-first-system-admin";

export function bootstrapMode(
  environment: NodeJS.ProcessEnv,
  args: string[],
): BootstrapMode {
  const modes = args.filter((arg) =>
    ["--check", "--create", "--validate"].includes(arg),
  );
  if (
    modes.length !== 1 ||
    args.some(
      (arg) =>
        !["--check", "--create", "--validate", "--confirm-bootstrap"].includes(
          arg,
        ),
    )
  )
    throw new SystemAdminBootstrapError(
      "Informe um modo: --check, --create ou --validate.",
    );
  if (!args.includes("--confirm-bootstrap"))
    throw new SystemAdminBootstrapError(
      "Operação bloqueada: exige --confirm-bootstrap para acessar o banco configurado.",
    );
  const nodeEnv = environment.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv))
    throw new SystemAdminBootstrapError("NODE_ENV inválido.");
  const mode = modes[0].slice(2) as BootstrapMode;
  if (
    mode === "create" &&
    nodeEnv === "production" &&
    environment.SYSTEM_ADMIN_ALLOW_PRODUCTION !== PRODUCTION_AUTHORIZATION
  )
    throw new SystemAdminBootstrapError(
      "Criação bloqueada em produção; exige SYSTEM_ADMIN_ALLOW_PRODUCTION explícito.",
    );
  return mode;
}

export function adminIdentity(
  environment: NodeJS.ProcessEnv,
  mode: BootstrapMode,
): AdminIdentity {
  const email = normalizedEmail(environment.SYSTEM_ADMIN_EMAIL ?? "");
  const identity =
    mode === "validate"
      ? { email }
      : {
          name: environment.SYSTEM_ADMIN_NAME?.trim() ?? "",
          email,
          password: environment.SYSTEM_ADMIN_PASSWORD ?? "",
        };
  const dto = plainToInstance(CreateUserDto, identity);
  const errors = validateSync(dto, {
    skipMissingProperties: mode === "validate",
  });
  if (!email || errors.length)
    throw new SystemAdminBootstrapError(
      "Configure SYSTEM_ADMIN_EMAIL válido e, para check/create, SYSTEM_ADMIN_NAME e SYSTEM_ADMIN_PASSWORD conforme CreateUserDto (nome até 150, senha 8..255 caracteres).",
    );
  if (
    identity.password !== undefined &&
    Buffer.byteLength(identity.password, "utf8") > 72
  )
    throw new SystemAdminBootstrapError(
      "SYSTEM_ADMIN_PASSWORD excede 72 bytes UTF-8; bcrypt não deve truncar a senha.",
    );
  return identity;
}

async function ensureAvailable(
  manager: EntityManager,
  email: string,
): Promise<void> {
  const users = manager.getRepository(User);
  // Do not use bootstrap as recovery: inactive administrators also block it.
  if (await users.existsBy({ isSystemAdmin: true }))
    throw new SystemAdminBootstrapError(
      "Bootstrap interrompido: já existe administrador global ativo ou inativo. Nenhum registro foi alterado.",
    );
  if (
    await users
      .createQueryBuilder("user")
      .where("LOWER(user.email) = :email", { email })
      .getExists()
  )
    throw new SystemAdminBootstrapError(
      "Bootstrap interrompido: email já pertence a um usuário; promoção e redefinição de senha são proibidas.",
    );
}

export async function bootstrapSystemAdmin(
  source: DataSource,
  mode: BootstrapMode,
  identity: AdminIdentity,
) {
  // Validate here too, so callers cannot bypass the CLI's DTO checks.
  const validated = adminIdentity(
    {
      SYSTEM_ADMIN_NAME: identity.name,
      SYSTEM_ADMIN_EMAIL: identity.email,
      SYSTEM_ADMIN_PASSWORD: identity.password,
    },
    mode,
  );
  if (
    !source.isInitialized ||
    source.options.synchronize ||
    source.options.migrationsRun ||
    source.options.logging
  )
    throw new SystemAdminBootstrapError(
      "Bootstrap exige DataSource inicializado, synchronize:false, migrationsRun:false e logging:false.",
    );
  const runner = source.createQueryRunner();
  let committed = false;
  try {
    await runner.connect();
    await runner.startTransaction(
      mode === "create" ? "READ COMMITTED" : "REPEATABLE READ",
    );
    if (mode !== "create") await runner.query("SET TRANSACTION READ ONLY");
    else {
      await runner.query("SET LOCAL lock_timeout = '5s'");
      // Also serializes against normal user inserts/promotions, not just this CLI.
      await runner.query('LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE');
    }
    if (mode === "validate") {
      const existing = await runner.manager
        .getRepository(User)
        .createQueryBuilder("user")
        .where("LOWER(user.email) = :email", { email: validated.email })
        .andWhere("user.active = true AND user.isSystemAdmin = true")
        .getExists();
      if (!existing)
        throw new SystemAdminBootstrapError(
          "Validação falhou: a conta indicada não é administrador global ativo.",
        );
      return { mode, administratorExists: true, modified: false };
    }
    await ensureAvailable(runner.manager, validated.email);
    if (mode === "check") return { mode, canBootstrap: true, modified: false };
    const passwordHash = await new BcryptService().hash(validated.password);
    await runner.manager.getRepository(User).insert({
      name: validated.name,
      email: validated.email,
      passwordHash,
      active: true,
      isSystemAdmin: true,
      tokenVersion: 0,
    });
    await runner.commitTransaction();
    committed = true;
    return { mode, administratorCreated: true, modified: true };
  } finally {
    try {
      if (!committed && runner.isTransactionActive)
        await runner.rollbackTransaction();
    } finally {
      await runner.release();
    }
  }
}
