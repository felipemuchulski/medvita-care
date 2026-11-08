import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExams1794096000000 implements MigrationInterface {
  name = "AddExams1794096000000";

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `CREATE TYPE "exams_status_enum" AS ENUM ('REQUESTED','IN_PROGRESS','COMPLETED','CANCELLED')`,
    );
    await runner.query(
      `CREATE TYPE "exams_laterality_enum" AS ENUM ('OD','OS','AO')`,
    );
    await runner.query(`CREATE TABLE "exam_types" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "code" varchar(40) NOT NULL UNIQUE,
      "name" varchar(150) NOT NULL,
      "description" text,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(`INSERT INTO "exam_types" ("code", "name") VALUES
      ('OCT','Tomografia de Coerência Óptica (OCT)'),
      ('CAMPIMETRY','Campimetria'), ('CORNEAL_TOPOGRAPHY','Topografia corneana'),
      ('PACHYMETRY','Paquimetria'), ('BIOMETRY','Biometria'), ('RETINOGRAPHY','Retinografia')
      ON CONFLICT ("code") DO NOTHING`);
    await runner.query(
      `CREATE UNIQUE INDEX "UQ_patients_exam_scope" ON "patients" ("id", "clinic_id")`,
    );
    await runner.query(
      `CREATE UNIQUE INDEX "UQ_encounters_exam_scope" ON "encounters" ("id", "clinic_id", "patient_id", "professional_id")`,
    );
    await runner.query(`CREATE TABLE "exams" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE RESTRICT,
      "patient_id" uuid NOT NULL,
      "encounter_id" uuid,
      "exam_type_id" uuid NOT NULL REFERENCES "exam_types"("id") ON DELETE RESTRICT,
      "requested_by_professional_id" uuid NOT NULL REFERENCES "professional_profiles"("id") ON DELETE RESTRICT,
      "laterality" exams_laterality_enum NOT NULL,
      "status" exams_status_enum NOT NULL DEFAULT 'REQUESTED',
      "requested_at" timestamptz NOT NULL DEFAULT now(),
      "performed_at" timestamptz,
      "completed_at" timestamptz,
      "cancelled_at" timestamptz,
      "result_text" text,
      "notes" text,
      "cancellation_reason" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_exams_patient_scope" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "patients"("id", "clinic_id") ON DELETE RESTRICT,
      CONSTRAINT "FK_exams_encounter_scope" FOREIGN KEY ("encounter_id", "clinic_id", "patient_id", "requested_by_professional_id") REFERENCES "encounters"("id", "clinic_id", "patient_id", "professional_id") ON DELETE RESTRICT,
      CONSTRAINT "CHK_exams_performed_period" CHECK ("performed_at" IS NULL OR "performed_at" >= "requested_at"),
      CONSTRAINT "CHK_exams_result_length" CHECK (char_length("result_text") <= 12000),
      CONSTRAINT "CHK_exams_notes_length" CHECK (char_length("notes") <= 4000),
      CONSTRAINT "CHK_exams_in_progress" CHECK ("status" NOT IN ('IN_PROGRESS','COMPLETED') OR (length(trim("result_text")) > 0 AND "performed_at" IS NOT NULL AND "result_text" IS NOT NULL)),
      CONSTRAINT "CHK_exams_completion" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
      CONSTRAINT "CHK_exams_cancellation" CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL) AND ("status" <> 'CANCELLED' OR ("cancellation_reason" IS NOT NULL AND length(trim("cancellation_reason")) BETWEEN 1 AND 2000)))
    )`);
    await runner.query(
      `CREATE INDEX "IDX_exams_clinic_owner_requested" ON "exams" ("clinic_id", "requested_by_professional_id", "requested_at" DESC, "id" DESC)`,
    );
    await runner.query(
      `CREATE INDEX "IDX_exams_clinic_patient_requested" ON "exams" ("clinic_id", "patient_id", "requested_at" DESC)`,
    );
    await runner.query(
      `CREATE INDEX "IDX_exams_clinic_status_requested" ON "exams" ("clinic_id", "status", "requested_at" DESC)`,
    );
    await runner.query(
      `CREATE INDEX "IDX_exams_encounter" ON "exams" ("encounter_id") WHERE "encounter_id" IS NOT NULL`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE "exams"`);
    await runner.query(`DROP INDEX "UQ_encounters_exam_scope"`);
    await runner.query(`DROP INDEX "UQ_patients_exam_scope"`);
    await runner.query(`DROP TABLE "exam_types"`);
    await runner.query(`DROP TYPE "exams_laterality_enum"`);
    await runner.query(`DROP TYPE "exams_status_enum"`);
  }
}
