import { Entity, Column, OneToMany, OneToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { ClinicUser } from "../../clinic-users/entities/clinic-user.entity";
import { ProfessionalProfile } from "../../professionals/entities/professional-profile.entity";

@Entity({ name: "users" })
export class User extends BaseEntity {
  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 150, unique: true })
  email: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash: string;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @OneToMany(() => ClinicUser, (clinicUser) => clinicUser.user)
  clinicUsers: ClinicUser[];

  @OneToOne(() => ProfessionalProfile, (profile) => profile.user)
  professionalProfile: ProfessionalProfile;
}
