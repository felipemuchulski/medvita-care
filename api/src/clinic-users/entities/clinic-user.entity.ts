import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { Clinic } from "../../clinics/entities/clinic.entity";
import { User } from "../../users/entities/user.entity";

export enum ClinicUserRole {
  ADMIN = "ADMIN",
  OPHTHALMOLOGIST = "OPHTHALMOLOGIST",
  RECEPTIONIST = "RECEPTIONIST",
}

@Index(["clinicId", "userId"], { unique: true })
@Entity({ name: "clinic_users" })
export class ClinicUser extends BaseEntity {
  @Column({ name: "clinic_id", type: "uuid" })
  clinicId: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ type: "enum", enum: ClinicUserRole })
  role: ClinicUserRole;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @ManyToOne(() => Clinic, (clinic) => clinic.clinicUsers)
  @JoinColumn({ name: "clinic_id" })
  clinic: Clinic;

  @ManyToOne(() => User, (user) => user.clinicUsers)
  @JoinColumn({ name: "user_id" })
  user: User;
}
