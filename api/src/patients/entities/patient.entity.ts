import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Relation,
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
  cpf: string | null;

  @Column({ name: "birth_date", type: "date" })
  birthDate: string;

  @Column({ type: "enum", enum: PatientSex, nullable: true })
  sex: PatientSex | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone: string | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  email: string | null;

  @Column({ name: "zip_code", type: "varchar", length: 8, nullable: true })
  zipCode: string | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  street: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  number: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  complement: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  neighborhood: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  city: string | null;

  @Column({ type: "char", length: 2, nullable: true })
  state: string | null;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @ManyToOne(() => Clinic, (clinic) => clinic.patients)
  @JoinColumn({ name: "clinic_id" })
  clinic: Relation<Clinic>;

  @OneToMany(() => Appointment, (appointment) => appointment.patient)
  appointments: Relation<Appointment[]>;

  @OneToMany(() => Encounter, (encounter) => encounter.patient)
  encounters: Relation<Encounter[]>;
}
