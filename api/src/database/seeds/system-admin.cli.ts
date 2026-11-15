import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "path";
import {
  adminIdentity,
  bootstrapMode,
  bootstrapSystemAdmin,
  SystemAdminBootstrapError,
} from "./system-admin.seed";

export async function main(): Promise<void> {
  config({ path: resolve(__dirname, "../../../.env") });
  // Refuse invalid input/absent confirmation before importing the DataSource.
  const mode = bootstrapMode(process.env, process.argv.slice(2));
  const identity = adminIdentity(process.env, mode);
  const source = (await import("../data-source")).default;
  source.setOptions({ logging: false });
  try {
    await source.initialize();
    console.log(
      JSON.stringify(await bootstrapSystemAdmin(source, mode, identity)),
    );
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof SystemAdminBootstrapError
        ? error.message
        : "Bootstrap cancelado. Verifique conexão TLS, migrations, permissões e concorrência. Detalhes sensíveis omitidos.",
    );
    process.exitCode = 1;
  });
}
