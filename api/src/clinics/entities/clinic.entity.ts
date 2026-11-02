import { Entity, Column, OneToMany, Relation } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { ClinicUser } from "../../clinic-users/entities/clinic-user.entity";
import { Patient } from "../../patients/entities/patient.entity";
import { Appointment } from "../../appointments/entities/appointment.entity";
import { Encounter } from "../../encounters/entities/encounter.entity";

@Entity({ name: "clinics" })
export class Clinic extends BaseEntity {
  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 14, unique: true })
  document: string;

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

  @OneToMany(() => ClinicUser, (clinicUser) => clinicUser.clinic)
  clinicUsers: Relation<ClinicUser[]>;

  @OneToMany(() => Patient, (patient) => patient.clinic)
  patients: Relation<Patient[]>;

  @OneToMany(() => Appointment, (appointment) => appointment.clinic)
  appointments: Relation<Appointment[]>;

  @OneToMany(() => Encounter, (encounter) => encounter.clinic)
  encounters: Relation<Encounter[]>;
}
