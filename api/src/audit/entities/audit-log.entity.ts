import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum AuditAction {
  LOGIN_SUCCEEDED = "LOGIN_SUCCEEDED",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  PATIENT_CREATED = "PATIENT_CREATED",
  PATIENT_UPDATED = "PATIENT_UPDATED",
  PATIENT_STATUS_CHANGED = "PATIENT_STATUS_CHANGED",
  PATIENT_READ = "PATIENT_READ",
  APPOINTMENT_CREATED = "APPOINTMENT_CREATED",
  APPOINTMENT_RESCHEDULED = "APPOINTMENT_RESCHEDULED",
  APPOINTMENT_CANCELLED = "APPOINTMENT_CANCELLED",
  APPOINTMENT_COMPLETED = "APPOINTMENT_COMPLETED",
  ENCOUNTER_STARTED = "ENCOUNTER_STARTED",
  ENCOUNTER_UPDATED = "ENCOUNTER_UPDATED",
  ENCOUNTER_COMPLETED = "ENCOUNTER_COMPLETED",
  ENCOUNTER_CANCELLED = "ENCOUNTER_CANCELLED",
  ENCOUNTER_READ = "ENCOUNTER_READ",
  CLINIC_MEMBERSHIP_CREATED = "CLINIC_MEMBERSHIP_CREATED",
  CLINIC_MEMBERSHIP_ROLE_CHANGED = "CLINIC_MEMBERSHIP_ROLE_CHANGED",
  CLINIC_MEMBERSHIP_STATUS_CHANGED = "CLINIC_MEMBERSHIP_STATUS_CHANGED",
}

@Index("IDX_audit_logs_clinic_created_at", ["clinicId", "createdAt"])
@Index("IDX_audit_logs_resource", ["resourceType", "resourceId"])
@Entity({ name: "audit_logs" })
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actorId: string | null;

  @Column({ name: "clinic_id", type: "uuid", nullable: true })
  clinicId: string | null;

  @Column({ type: "varchar", length: 80 })
  action: AuditAction;

  @Column({ name: "resource_type", type: "varchar", length: 80 })
  resourceType: string;

  @Column({ name: "resource_id", type: "uuid", nullable: true })
  resourceId: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
