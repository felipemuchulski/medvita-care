import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  Relation,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity({ name: "auth_sessions" })
export class AuthSession {
  @PrimaryColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ name: "refresh_token_hash", type: "varchar", length: 255 })
  refreshTokenHash: string;

  @Column({ name: "refresh_token_jti", type: "uuid" })
  refreshTokenJti: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: Relation<User>;
}
