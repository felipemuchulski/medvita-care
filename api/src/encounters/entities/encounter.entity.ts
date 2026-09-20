import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from "typeorm";
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
  finishedAt: Date;

  @Column({ name: "clinical_notes", type: "text", nullable: true })
  clinicalNotes: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.encounters)
  @JoinColumn({ name: "clinic_id" })
  clinic: Clinic;

  @ManyToOne(() => Patient, (patient) => patient.encounters)
  @JoinColumn({ name: "patient_id" })
  patient: Patient;

  @ManyToOne(() => ProfessionalProfile)
  @JoinColumn({ name: "professional_id" })
  professional: ProfessionalProfile;

  @OneToOne(() => Appointment, (appointment) => appointment.encounter)
  @JoinColumn({ name: "appointment_id" })
  appointment: Appointment;
}
