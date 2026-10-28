import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuthSessionsAndTokenRevocation1793210400000 implements MigrationInterface {
  name = "AddAuthSessionsAndTokenRevocation1793210400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_sessions" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "refresh_token_jti" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_auth_sessions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "revoked_tokens" ("jti" uuid NOT NULL, "user_id" uuid NOT NULL, "reason" character varying(50) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_revoked_tokens_jti" PRIMARY KEY ("jti"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_revoked_tokens_user_id" ON "revoked_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_revoked_tokens_expires_at" ON "revoked_tokens" ("expires_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_auth_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ADD CONSTRAINT "FK_revoked_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" DROP CONSTRAINT "FK_revoked_tokens_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_auth_sessions_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_revoked_tokens_expires_at"`);
    await queryRunner.query(`DROP INDEX "IDX_revoked_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE "revoked_tokens"`);
    await queryRunner.query(`DROP INDEX "IDX_auth_sessions_user_id"`);
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
  }
}
