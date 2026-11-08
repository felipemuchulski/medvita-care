import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";

@Entity({ name: "exam_types" })
export class ExamType extends BaseEntity {
  @Column({ type: "varchar", length: 40, unique: true })
  code: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "is_active", default: true })
  isActive: boolean;
}
