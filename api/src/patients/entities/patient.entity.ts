import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { Clinic } from "../../clinics/entities/clinic.entity";
import { Appointment } from "../../appointments/entities/appointment.entity";
import { Encounter } from "../../encounters/entities/encounter.entity";

export enum PatientSex {
  MALE = "MALE",
  FEMALE = "FEMALE",
  NOT_INFORMED = "NOT_INFORMED",
}

@Index(["clinicId", "cpf"], { unique: true, where: '"cpf" IS NOT NULL' })
@Entity({ name: "patients" })
export class Patient extends BaseEntity {
  @Column({ name: "clinic_id", type: "uuid" })
  clinicId: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 11, nullable: true })
  cpf: string;

  @Column({ name: "birth_date", type: "date" })
  birthDate: string;

  @Column({ type: "enum", enum: PatientSex, nullable: true })
  sex: PatientSex;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  email: string;

  @Column({ name: "zip_code", type: "varchar", length: 8, nullable: true })
  zipCode: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  street: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  number: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  complement: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  neighborhood: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  city: string;

  @Column({ type: "char", length: 2, nullable: true })
  state: string;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @ManyToOne(() => Clinic, (clinic) => clinic.patients)
  @JoinColumn({ name: "clinic_id" })
  clinic: Clinic;

  @OneToMany(() => Appointment, (appointment) => appointment.patient)
  appointments: Appointment[];

  @OneToMany(() => Encounter, (encounter) => encounter.patient)
  encounters: Encounter[];
}
