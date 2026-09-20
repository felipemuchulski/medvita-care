import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { Clinic } from "../../clinics/entities/clinic.entity";
import { Patient } from "../../patients/entities/patient.entity";
import { ProfessionalProfile } from "../../professionals/entities/professional-profile.entity";
import { Encounter } from "../../encounters/entities/encounter.entity";

export enum AppointmentStatus {
  SCHEDULED = "SCHEDULED",
  CONFIRMED = "CONFIRMED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

@Entity({ name: "appointments" })
export class Appointment extends BaseEntity {
  @Column({ name: "clinic_id", type: "uuid" })
  clinicId: string;

  @Column({ name: "patient_id", type: "uuid" })
  patientId: string;

  @Column({ name: "professional_id", type: "uuid" })
  professionalId: string;

  @Column({ name: "scheduled_at", type: "timestamptz" })
  scheduledAt: Date;

  @Column({ name: "duration_minutes", type: "smallint", default: 30 })
  durationMinutes: number;

  @Column({ type: "enum", enum: AppointmentStatus })
  status: AppointmentStatus;

  @Column({ type: "text", nullable: true })
  reason: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.appointments)
  @JoinColumn({ name: "clinic_id" })
  clinic: Clinic;

  @ManyToOne(() => Patient, (patient) => patient.appointments)
  @JoinColumn({ name: "patient_id" })
  patient: Patient;

  @ManyToOne(() => ProfessionalProfile)
  @JoinColumn({ name: "professional_id" })
  professional: ProfessionalProfile;

  @OneToOne(() => Encounter, (encounter) => encounter.appointment)
  encounter: Encounter;
}
