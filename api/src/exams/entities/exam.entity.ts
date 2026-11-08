import { Column, Entity, JoinColumn, ManyToOne, Relation } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { Clinic } from "../../clinics/entities/clinic.entity";
import { Patient } from "../../patients/entities/patient.entity";
import { Encounter } from "../../encounters/entities/encounter.entity";
import { ProfessionalProfile } from "../../professionals/entities/professional-profile.entity";
import { ExamType } from "./exam-type.entity";

export enum ExamStatus {
  REQUESTED = "REQUESTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum ExamLaterality {
  OD = "OD",
  OS = "OS",
  AO = "AO",
}

@Entity({ name: "exams" })
export class Exam extends BaseEntity {
  @Column({ name: "clinic_id", type: "uuid" })
  clinicId: string;

  @Column({ name: "patient_id", type: "uuid" })
  patientId: string;

  @Column({ name: "encounter_id", type: "uuid", nullable: true })
  encounterId: string | null;

  @Column({ name: "exam_type_id", type: "uuid" })
  examTypeId: string;

  @Column({ name: "requested_by_professional_id", type: "uuid" })
  requestedByProfessionalId: string;

  @Column({
    type: "enum",
    enum: ExamLaterality,
    enumName: "exams_laterality_enum",
  })
  laterality: ExamLaterality;

  @Column({ type: "enum", enum: ExamStatus, enumName: "exams_status_enum" })
  status: ExamStatus;

  @Column({ name: "requested_at", type: "timestamptz" })
  requestedAt: Date;

  @Column({ name: "performed_at", type: "timestamptz", nullable: true })
  performedAt: Date | null;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt: Date | null;

  @Column({ name: "result_text", type: "text", nullable: true })
  resultText: string | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "cancellation_reason", type: "text", nullable: true })
  cancellationReason: string | null;

  @ManyToOne(() => Clinic, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "clinic_id" })
  clinic: Relation<Clinic>;

  @ManyToOne(() => Patient, { onDelete: "RESTRICT" })
  @JoinColumn([
    { name: "patient_id", referencedColumnName: "id" },
    { name: "clinic_id", referencedColumnName: "clinicId" },
  ])
  patient: Relation<Patient>;

  @ManyToOne(() => Encounter, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn([
    { name: "encounter_id", referencedColumnName: "id" },
    { name: "clinic_id", referencedColumnName: "clinicId" },
    { name: "patient_id", referencedColumnName: "patientId" },
    {
      name: "requested_by_professional_id",
      referencedColumnName: "professionalId",
    },
  ])
  encounter: Relation<Encounter>;

  @ManyToOne(() => ExamType, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "exam_type_id" })
  examType: Relation<ExamType>;

  @ManyToOne(() => ProfessionalProfile, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "requested_by_professional_id" })
  requestedByProfessional: Relation<ProfessionalProfile>;
}
