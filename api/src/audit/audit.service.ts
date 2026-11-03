import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";
import { AuditAction, AuditLog } from "./entities/audit-log.entity";

export type AuditEvent = {
  actorId?: string | null;
  clinicId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEYS =
  /password|secret|token|hash|clinical|anamnesis|assessment|plan|complaint|notes/i;

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  async record(event: AuditEvent, manager?: EntityManager): Promise<AuditLog> {
    const repository = manager
      ? manager.getRepository(AuditLog)
      : this.auditLogsRepository;
    return repository.save(
      repository.create({
        actorId: event.actorId ?? null,
        clinicId: event.clinicId ?? null,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        metadata: this.sanitizeMetadata(event.metadata ?? {}),
      }),
    );
  }

  async recordBestEffort(event: AuditEvent): Promise<void> {
    try {
      await this.record(event);
    } catch {
      // A autenticação não deve criar uma sessão inválida para o cliente por
      // uma indisponibilidade posterior e independente da trilha de auditoria.
    }
  }

  async recordSensitiveRead(event: AuditEvent): Promise<void> {
    try {
      await this.record(event);
    } catch {
      throw new ServiceUnavailableException(
        "A leitura não pôde ser auditada e foi bloqueada.",
      );
    }
  }

  async findAll(
    clinicId: string,
    query: ListAuditLogsQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertClinicAdmin(currentUser, clinicId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const builder = this.auditLogsRepository
      .createQueryBuilder("audit")
      .where("audit.clinic_id = :clinicId", { clinicId });

    if (query.action) {
      builder.andWhere("audit.action = :action", { action: query.action });
    }
    if (query.actorId) {
      builder.andWhere("audit.actor_id = :actorId", {
        actorId: query.actorId,
      });
    }
    if (query.resourceType) {
      builder.andWhere("audit.resource_type = :resourceType", {
        resourceType: query.resourceType.trim(),
      });
    }
    if (query.resourceId) {
      builder.andWhere("audit.resource_id = :resourceId", {
        resourceId: query.resourceId,
      });
    }
    if (query.from) {
      builder.andWhere("audit.created_at >= :from", {
        from: new Date(query.from),
      });
    }
    if (query.to) {
      builder.andWhere("audit.created_at <= :to", { to: new Date(query.to) });
    }

    const [data, total] = await builder
      .orderBy("audit.created_at", "DESC")
      .addOrderBy("audit.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private assertClinicAdmin(
    currentUser: AuthenticatedUser,
    clinicId: string,
  ): void {
    const role = currentUser.clinicRoles.find(
      (membership) => membership.clinicId === clinicId,
    )?.role;
    if (role !== ClinicUserRole.ADMIN) {
      throw new ForbiddenException(
        "A consulta da auditoria exige vínculo ADMIN ativo com a clínica.",
      );
    }
  }

  private sanitizeMetadata(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => !SENSITIVE_KEYS.test(key))
        .slice(0, 30)
        .map(([key, value]) => [key, this.sanitizeValue(value)]),
    );
  }

  private sanitizeValue(value: unknown): unknown {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number"
    ) {
      return value;
    }
    if (typeof value === "string") return value.slice(0, 300);
    if (Array.isArray(value)) {
      return value.slice(0, 20).map((item) => this.sanitizeValue(item));
    }
    return "[REDACTED]";
  }
}
