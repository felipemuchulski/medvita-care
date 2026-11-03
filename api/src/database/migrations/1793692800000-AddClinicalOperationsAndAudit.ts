import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClinicalOperationsAndAudit1793692800000 implements MigrationInterface {
  name = "AddClinicalOperationsAndAudit1793692800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);

    await queryRunner.query(
      `ALTER TABLE "appointments" ADD "ends_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "appointments" SET "ends_at" = "scheduled_at" + ("duration_minutes" * INTERVAL '1 minute')`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ALTER COLUMN "ends_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD "cancellation_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD "cancelled_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "CHK_appointments_valid_period" CHECK ("scheduled_at" < "ends_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "CHK_appointments_duration" CHECK ("duration_minutes" BETWEEN 5 AND 480)`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "EX_appointments_professional_period" EXCLUDE USING gist ("professional_id" WITH =, tstzrange("scheduled_at", "ends_at", '[)') WITH &&) WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_clinic_scheduled_at" ON "appointments" ("clinic_id", "scheduled_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "encounters" ADD "chief_complaint" text`,
    );
    await queryRunner.query(`ALTER TABLE "encounters" ADD "anamnesis" text`);
    await queryRunner.query(
      `ALTER TABLE "encounters" ADD "visual_acuity_right" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "encounters" ADD "visual_acuity_left" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "encounters" ADD "intraocular_pressure_right" numeric(5,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "encounters" ADD "intraocular_pressure_left" numeric(5,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "encounters" ADD "clinical_assessment" text`,
    );
    await queryRunner.query(`ALTER TABLE "encounters" ADD "plan" text`);
    await queryRunner.query(
      `ALTER TABLE "encounters" ADD "cancellation_reason" text`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_encounters_clinic_started_at" ON "encounters" ("clinic_id", "started_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_encounters_patient_started_at" ON "encounters" ("patient_id", "started_at")`,
    );

    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "clinic_id" uuid, "action" character varying(80) NOT NULL, "resource_type" character varying(80) NOT NULL, "resource_id" uuid, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_clinic_created_at" ON "audit_logs" ("clinic_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actor_created_at" ON "audit_logs" ("actor_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_actor_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_resource"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_clinic_created_at"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);

    await queryRunner.query(`DROP INDEX "IDX_encounters_patient_started_at"`);
    await queryRunner.query(`DROP INDEX "IDX_encounters_clinic_started_at"`);
    await queryRunner.query(
      `ALTER TABLE "encounters" DROP COLUMN "cancellation_reason"`,
    );
    await queryRunner.query(`ALTER TABLE "encounters" DROP COLUMN "plan"`);
    await queryRunner.query(
      `ALTER TABLE "encounters" DROP COLUMN "clinical_assessment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "encounters" DROP COLUMN "intraocular_pressure_left"`,
    );
    await queryRunner.query(
      `ALTER TABLE "encounters" DROP COLUMN "intraocular_pressure_right"`,
    );
    await queryRunner.query(
      `ALTER TABLE "encounters" DROP COLUMN "visual_acuity_left"`,
    );
    await queryRunner.query(
      `ALTER TABLE "encounters" DROP COLUMN "visual_acuity_right"`,
    );
    await queryRunner.query(`ALTER TABLE "encounters" DROP COLUMN "anamnesis"`);
    await queryRunner.query(
      `ALTER TABLE "encounters" DROP COLUMN "chief_complaint"`,
    );

    await queryRunner.query(
      `DROP INDEX "IDX_appointments_clinic_scheduled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "EX_appointments_professional_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "CHK_appointments_duration"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "CHK_appointments_valid_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP COLUMN "cancelled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP COLUMN "cancellation_reason"`,
    );
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "ends_at"`);
  }
}
