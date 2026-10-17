import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsSystemAdminToUsers1792265281923 implements MigrationInterface {
    name = 'AddIsSystemAdminToUsers1792265281923'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "professional_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "crm" character varying(20) NOT NULL, "crm_state" character(2) NOT NULL, "rqe" character varying(20), "specialty" character varying(100) NOT NULL DEFAULT 'Oftalmologia', CONSTRAINT "UQ_ed5f5b62a353f11b36ceb7e2e8e" UNIQUE ("user_id"), CONSTRAINT "REL_ed5f5b62a353f11b36ceb7e2e8" UNIQUE ("user_id"), CONSTRAINT "PK_b2140d2f56b0910e4c58ab4d2a2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4deacdee703876db7f98634b41" ON "professional_profiles" ("crm", "crm_state") `);
        await queryRunner.query(`CREATE TYPE "public"."encounters_status_enum" AS ENUM('IN_PROGRESS', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "encounters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "clinic_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "professional_id" uuid NOT NULL, "appointment_id" uuid, "status" "public"."encounters_status_enum" NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "finished_at" TIMESTAMP WITH TIME ZONE, "clinical_notes" text, CONSTRAINT "UQ_3a49c7c2abc9c2beca747de579c" UNIQUE ("appointment_id"), CONSTRAINT "REL_3a49c7c2abc9c2beca747de579" UNIQUE ("appointment_id"), CONSTRAINT "PK_b2e596be58aabc4ccc8f8458b53" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."appointments_status_enum" AS ENUM('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')`);
        await queryRunner.query(`CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "clinic_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "professional_id" uuid NOT NULL, "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL, "duration_minutes" smallint NOT NULL DEFAULT '30', "status" "public"."appointments_status_enum" NOT NULL, "reason" text, "notes" text, CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."patients_sex_enum" AS ENUM('MALE', 'FEMALE', 'NOT_INFORMED')`);
        await queryRunner.query(`CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "clinic_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "cpf" character varying(11), "birth_date" date NOT NULL, "sex" "public"."patients_sex_enum", "phone" character varying(20), "email" character varying(150), "zip_code" character varying(8), "street" character varying(150), "number" character varying(20), "complement" character varying(100), "neighborhood" character varying(100), "city" character varying(100), "state" character(2), "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_78161f66523fba6d1369f859b1" ON "patients" ("clinic_id", "cpf") WHERE "cpf" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "clinics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(150) NOT NULL, "document" character varying(14) NOT NULL, "phone" character varying(20), "email" character varying(150), "zip_code" character varying(8), "street" character varying(150), "number" character varying(20), "complement" character varying(100), "neighborhood" character varying(100), "city" character varying(100), "state" character(2), "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_5da95b90bdb1b8c7b06cadae748" UNIQUE ("document"), CONSTRAINT "PK_5513b659e4d12b01a8ab3956abc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."clinic_users_role_enum" AS ENUM('ADMIN', 'OPHTHALMOLOGIST', 'RECEPTIONIST')`);
        await queryRunner.query(`CREATE TABLE "clinic_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "clinic_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."clinic_users_role_enum" NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_48c29549be40b5cfa62d7087e7f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_19b615418fda5d26fbe06ffe42" ON "clinic_users" ("clinic_id", "user_id") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(150) NOT NULL, "email" character varying(150) NOT NULL, "password_hash" character varying(255) NOT NULL, "active" boolean NOT NULL DEFAULT true, "is_system_admin" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "professional_profiles" ADD CONSTRAINT "FK_ed5f5b62a353f11b36ceb7e2e8e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "encounters" ADD CONSTRAINT "FK_2e2d13a4060f12961ffd8e986bd" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "encounters" ADD CONSTRAINT "FK_bb9694e5661b8635d77020d9529" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "encounters" ADD CONSTRAINT "FK_68c53fe06541a30b84adfd03d32" FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "encounters" ADD CONSTRAINT "FK_3a49c7c2abc9c2beca747de579c" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_5de9b36b534afa4cdfc183b9e41" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_3330f054416745deaa2cc130700" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_60b7a60cf6727d87d525a750414" FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_e04719758e19c1b94f3768aa7c9" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clinic_users" ADD CONSTRAINT "FK_faf62a0217e2b09d602228bc40a" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clinic_users" ADD CONSTRAINT "FK_7defd2ae65ea4ad98a0bf9fed50" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clinic_users" DROP CONSTRAINT "FK_7defd2ae65ea4ad98a0bf9fed50"`);
        await queryRunner.query(`ALTER TABLE "clinic_users" DROP CONSTRAINT "FK_faf62a0217e2b09d602228bc40a"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_e04719758e19c1b94f3768aa7c9"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_60b7a60cf6727d87d525a750414"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_3330f054416745deaa2cc130700"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_5de9b36b534afa4cdfc183b9e41"`);
        await queryRunner.query(`ALTER TABLE "encounters" DROP CONSTRAINT "FK_3a49c7c2abc9c2beca747de579c"`);
        await queryRunner.query(`ALTER TABLE "encounters" DROP CONSTRAINT "FK_68c53fe06541a30b84adfd03d32"`);
        await queryRunner.query(`ALTER TABLE "encounters" DROP CONSTRAINT "FK_bb9694e5661b8635d77020d9529"`);
        await queryRunner.query(`ALTER TABLE "encounters" DROP CONSTRAINT "FK_2e2d13a4060f12961ffd8e986bd"`);
        await queryRunner.query(`ALTER TABLE "professional_profiles" DROP CONSTRAINT "FK_ed5f5b62a353f11b36ceb7e2e8e"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_19b615418fda5d26fbe06ffe42"`);
        await queryRunner.query(`DROP TABLE "clinic_users"`);
        await queryRunner.query(`DROP TYPE "public"."clinic_users_role_enum"`);
        await queryRunner.query(`DROP TABLE "clinics"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_78161f66523fba6d1369f859b1"`);
        await queryRunner.query(`DROP TABLE "patients"`);
        await queryRunner.query(`DROP TYPE "public"."patients_sex_enum"`);
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
        await queryRunner.query(`DROP TABLE "encounters"`);
        await queryRunner.query(`DROP TYPE "public"."encounters_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4deacdee703876db7f98634b41"`);
        await queryRunner.query(`DROP TABLE "professional_profiles"`);
    }

}
