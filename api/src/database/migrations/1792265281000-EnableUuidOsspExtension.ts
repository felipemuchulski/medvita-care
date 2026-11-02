import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableUuidOsspExtension1792265281000 implements MigrationInterface {
  name = "EnableUuidOsspExtension1792265281000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(): Promise<void> {
    // A extensão pode ser compartilhada por outras tabelas ou aplicações.
    // O rollback não a remove para evitar uma operação destrutiva.
  }
}
