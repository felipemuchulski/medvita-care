import { Entity, Column, OneToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { User } from "../../users/entities/user.entity";

@Index(["crm", "crmState"], { unique: true })
@Entity({ name: "professional_profiles" })
export class ProfessionalProfile extends BaseEntity {
  @Column({ name: "user_id", type: "uuid", unique: true })
  userId: string;

  @Column({ type: "varchar", length: 20 })
  crm: string;

  @Column({ name: "crm_state", type: "char", length: 2 })
  crmState: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  rqe: string;

  @Column({ type: "varchar", length: 100, default: "Oftalmologia" })
  specialty: string;

  @OneToOne(() => User, (user) => user.professionalProfile)
  @JoinColumn({ name: "user_id" })
  user: User;
}
