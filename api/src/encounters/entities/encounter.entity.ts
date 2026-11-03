import {
  Entity,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { Clinic } from "../../clinics/entities/clinic.entity";
import { Patient } from "../../patients/entities/patient.entity";
import { ProfessionalProfile } from "../../professionals/entities/professional-profile.entity";
import { Appointment } from "../../appointments/entities/appointment.entity";

export enum EncounterStatus {
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

@Entity({ name: "encounters" })
export class Encounter extends BaseEntity {
  @Column({ name: "clinic_id", type: "uuid" })
  clinicId: string;

  @Column({ name: "patient_id", type: "uuid" })
  patientId: string;

  @Column({ name: "professional_id", type: "uuid" })
  professionalId: string;

  @Column({
    name: "appointment_id",
    type: "uuid",
    nullable: true,
    unique: true,
  })
  appointmentId: string;

  @Column({ type: "enum", enum: EncounterStatus })
  status: EncounterStatus;

  @Column({ name: "started_at", type: "timestamptz" })
  startedAt: Date;

  @Column({ name: "finished_at", type: "timestamptz", nullable: true })
  finishedAt: Date | null;

  @Column({ name: "clinical_notes", type: "text", nullable: true })
  clinicalNotes: string | null;

  @Column({ name: "chief_complaint", type: "text", nullable: true })
  chiefComplaint: string | null;

  @Column({ type: "text", nullable: true })
  anamnesis: string | null;

  @Column({
    name: "visual_acuity_right",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  visualAcuityRight: string | null;

  @Column({
    name: "visual_acuity_left",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  visualAcuityLeft: string | null;

  @Column({
    name: "intraocular_pressure_right",
    type: "numeric",
    precision: 5,
    scale: 2,
    nullable: true,
  })
  intraocularPressureRight: number | null;

  @Column({
    name: "intraocular_pressure_left",
    type: "numeric",
    precision: 5,
    scale: 2,
    nullable: true,
  })
  intraocularPressureLeft: number | null;

  @Column({ name: "clinical_assessment", type: "text", nullable: true })
  clinicalAssessment: string | null;

  @Column({ type: "text", nullable: true })
  plan: string | null;

  @Column({ name: "cancellation_reason", type: "text", nullable: true })
  cancellationReason: string | null;

  @ManyToOne(() => Clinic, (clinic) => clinic.encounters)
  @JoinColumn({ name: "clinic_id" })
  clinic: Relation<Clinic>;

  @ManyToOne(() => Patient, (patient) => patient.encounters)
  @JoinColumn({ name: "patient_id" })
  patient: Relation<Patient>;

  @ManyToOne(() => ProfessionalProfile)
  @JoinColumn({ name: "professional_id" })
  professional: Relation<ProfessionalProfile>;

  @OneToOne(() => Appointment, (appointment) => appointment.encounter)
  @JoinColumn({ name: "appointment_id" })
  appointment: Relation<Appointment>;
}
