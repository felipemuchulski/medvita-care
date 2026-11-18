import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  HttpException,
  ServiceUnavailableException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { applyTextSearch } from "src/common/utils/text-search.util";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/entities/audit-log.entity";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import {
  ClinicUser,
  ClinicUserRole,
} from "../clinic-users/entities/clinic-user.entity";
import { Patient } from "../patients/entities/patient.entity";
import { ProfessionalProfile } from "../professionals/entities/professional-profile.entity";
import {
  Encounter,
  EncounterStatus,
} from "../encounters/entities/encounter.entity";
import {
  CancelExamDto,
  CreateExamDto,
  QueryExamsDto,
  RecordExamResultDto,
  UpdateExamDto,
} from "./dto/exam.dto";
import { ExamType } from "./entities/exam-type.entity";
import { Exam, ExamStatus } from "./entities/exam.entity";

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
    private readonly audit: AuditService,
  ) {}

  private async authorize(
    manager: EntityManager,
    clinicId: string,
    user: AuthenticatedUser,
    lock = false,
  ) {
    if (
      !user.clinicRoles.some(
        (m) =>
          m.clinicId === clinicId && m.role === ClinicUserRole.OPHTHALMOLOGIST,
      )
    ) {
      throw new ForbiddenException(
        "Exames são restritos ao oftalmologista com vínculo ativo na clínica.",
      );
    }
    const builder = manager
      .getRepository(ProfessionalProfile)
      .createQueryBuilder("profile")
      .innerJoin("profile.user", "user", "user.active = true")
      .innerJoin(
        ClinicUser,
        "membership",
        "membership.userId = user.id AND membership.clinicId = :clinicId AND membership.active = true AND membership.role = :role",
        { clinicId, role: ClinicUserRole.OPHTHALMOLOGIST },
      )
      .innerJoin("membership.clinic", "clinic", "clinic.active = true")
      .where("profile.userId = :userId", { userId: user.sub });
    if (lock) builder.setLock("pessimistic_read");
    const professional = await builder.getOne();
    if (!professional)
      throw new ForbiddenException(
        "É necessário perfil profissional e vínculo ativo de oftalmologista nesta clínica.",
      );
    return professional;
  }

  async types(clinicId: string, user: AuthenticatedUser) {
    await this.authorize(this.exams.manager, clinicId, user);
    return this.exams.manager
      .getRepository(ExamType)
      .find({ where: { isActive: true }, order: { name: "ASC" } });
  }

  async create(clinicId: string, dto: CreateExamDto, user: AuthenticatedUser) {
    return this.transaction(async (manager) => {
      const professional = await this.authorize(manager, clinicId, user, true);
      const patient = await manager.getRepository(Patient).findOne({
        where: { id: dto.patientId, clinicId, active: true },
        lock: { mode: "pessimistic_read" },
      });
      if (!patient)
        throw new NotFoundException(
          "Paciente ativo não encontrado nesta clínica.",
        );
      const type = await manager.getRepository(ExamType).findOne({
        where: { id: dto.examTypeId, isActive: true },
        lock: { mode: "pessimistic_read" },
      });
      if (!type)
        throw new NotFoundException("Tipo de exame ativo não encontrado.");
      if (dto.encounterId) {
        const encounter = await manager.getRepository(Encounter).findOne({
          where: {
            id: dto.encounterId,
            clinicId,
            patientId: patient.id,
            professionalId: professional.id,
          },
          lock: { mode: "pessimistic_read" },
        });
        if (!encounter)
          throw new NotFoundException(
            "Atendimento não encontrado para este paciente, clínica e profissional.",
          );
        if (encounter.status === EncounterStatus.CANCELLED)
          throw new BadRequestException(
            "Não é possível associar exame a atendimento cancelado.",
          );
      }
      const repository = manager.getRepository(Exam);
      const saved = await repository.save(
        repository.create({
          clinicId,
          patientId: patient.id,
          encounterId: dto.encounterId ?? null,
          requestedByProfessionalId: professional.id,
          examTypeId: type.id,
          laterality: dto.laterality,
          notes: dto.notes?.trim() || null,
          status: ExamStatus.REQUESTED,
          requestedAt: new Date(),
          performedAt: null,
          resultText: null,
          completedAt: null,
          cancelledAt: null,
          cancellationReason: null,
        }),
      );
      await this.writeAudit(manager, user, saved, AuditAction.EXAM_REQUESTED);
      return this.mutationResponse(manager, user, saved);
    });
  }

  async list(clinicId: string, query: QueryExamsDto, user: AuthenticatedUser) {
    const professional = await this.authorize(
      this.exams.manager,
      clinicId,
      user,
    );
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      throw new BadRequestException(
        "O início do período não pode ser posterior ao fim.",
      );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const builder = this.viewQuery(clinicId, professional.id);
    for (const field of [
      "patientId",
      "encounterId",
      "examTypeId",
      "status",
    ] as const) {
      if (query[field])
        builder.andWhere(`exam.${field} = :${field}`, {
          [field]: query[field],
        });
    }
    if (query.from)
      builder.andWhere("exam.requestedAt >= :from", { from: query.from });
    if (query.to) builder.andWhere("exam.requestedAt <= :to", { to: query.to });
    applyTextSearch(
      builder,
      ["patient.name", "type.name"],
      query.search,
      "patient.cpf",
    );
    // Results are fetched only in the audited detail endpoint.
    const [data, total] = await builder
      .orderBy("exam.requestedAt", "DESC")
      .addOrderBy("exam.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    await this.audit.recordSensitiveRead({
      actorId: user.sub,
      clinicId,
      action: AuditAction.EXAM_READ,
      resourceType: "ExamList",
      metadata: { page, resultCount: data.length },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async detail(clinicId: string, id: string, user: AuthenticatedUser) {
    const professional = await this.authorize(
      this.exams.manager,
      clinicId,
      user,
    );
    const exam = await this.viewQuery(clinicId, professional.id)
      .addSelect(["exam.notes", "exam.resultText", "exam.cancellationReason"])
      .andWhere("exam.id = :id", { id })
      .getOne();
    if (!exam)
      throw new NotFoundException(
        "Exame não encontrado ou não autorizado nesta clínica.",
      );
    await this.audit.recordSensitiveRead({
      actorId: user.sub,
      clinicId,
      action: AuditAction.EXAM_READ,
      resourceType: "Exam",
      resourceId: exam.id,
    });
    return exam;
  }

  update(
    clinicId: string,
    id: string,
    dto: UpdateExamDto,
    user: AuthenticatedUser,
  ) {
    return this.mutate(clinicId, id, user, AuditAction.EXAM_UPDATED, (exam) => {
      if (exam.status !== ExamStatus.REQUESTED)
        throw new ConflictException(
          "As informações da solicitação só podem ser alteradas antes do registro de resultado.",
        );
      if (dto.laterality !== undefined) exam.laterality = dto.laterality;
      if (dto.notes !== undefined) exam.notes = dto.notes.trim() || null;
    });
  }

  result(
    clinicId: string,
    id: string,
    dto: RecordExamResultDto,
    user: AuthenticatedUser,
  ) {
    return this.mutate(
      clinicId,
      id,
      user,
      AuditAction.EXAM_RESULT_RECORDED,
      (exam) => {
        this.assertOpen(exam);
        const performedAt = new Date(dto.performedAt);
        if (
          !Number.isFinite(performedAt.getTime()) ||
          performedAt > new Date() ||
          performedAt < exam.requestedAt
        )
          throw new BadRequestException(
            "A realização deve ocorrer entre a solicitação e o momento atual.",
          );
        if (!dto.resultText.trim())
          throw new BadRequestException("Informe o resultado do exame.");
        exam.resultText = dto.resultText.trim();
        exam.performedAt = performedAt;
        exam.status = ExamStatus.IN_PROGRESS;
      },
    );
  }

  complete(clinicId: string, id: string, user: AuthenticatedUser) {
    return this.mutate(
      clinicId,
      id,
      user,
      AuditAction.EXAM_COMPLETED,
      (exam) => {
        if (
          exam.status !== ExamStatus.IN_PROGRESS ||
          !exam.resultText?.trim() ||
          !exam.performedAt
        )
          throw new ConflictException(
            "Registre o resultado e a data de realização antes de concluir o exame.",
          );
        exam.status = ExamStatus.COMPLETED;
        exam.completedAt = new Date();
      },
    );
  }

  cancel(
    clinicId: string,
    id: string,
    dto: CancelExamDto,
    user: AuthenticatedUser,
  ) {
    return this.mutate(
      clinicId,
      id,
      user,
      AuditAction.EXAM_CANCELLED,
      (exam) => {
        this.assertOpen(exam);
        if (!dto.reason.trim())
          throw new BadRequestException("Informe o motivo do cancelamento.");
        exam.status = ExamStatus.CANCELLED;
        exam.cancelledAt = new Date();
        exam.cancellationReason = dto.reason.trim();
      },
    );
  }

  private async mutate(
    clinicId: string,
    id: string,
    user: AuthenticatedUser,
    action: AuditAction,
    apply: (exam: Exam) => void,
  ) {
    return this.transaction(async (manager) => {
      const professional = await this.authorize(manager, clinicId, user, true);
      const repository = manager.getRepository(Exam);
      const exam = await repository.findOne({
        where: { id, clinicId, requestedByProfessionalId: professional.id },
        lock: { mode: "pessimistic_write" },
      });
      if (!exam)
        throw new NotFoundException(
          "Exame não encontrado ou não autorizado nesta clínica.",
        );
      apply(exam);
      await repository.save(exam);
      await this.writeAudit(manager, user, exam, action);
      return this.mutationResponse(manager, user, exam);
    });
  }

  private async mutationResponse(
    manager: EntityManager,
    user: AuthenticatedUser,
    exam: Exam,
  ) {
    const response = await this.viewQuery(
      exam.clinicId,
      exam.requestedByProfessionalId,
      manager,
    )
      .addSelect(["exam.notes", "exam.resultText", "exam.cancellationReason"])
      .andWhere("exam.id = :id", { id: exam.id })
      .getOneOrFail();
    // Audit the returned clinical data in the same transaction: a read-audit failure
    // must not leave a committed request that the client believes failed to save.
    await this.writeAudit(manager, user, exam, AuditAction.EXAM_READ);
    return response;
  }

  private async transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.exams.manager.transaction(work);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Never let QueryFailedError parameters expose result text in Nest logs.
      throw new ServiceUnavailableException(
        "Não foi possível salvar o exame. Tente novamente.",
      );
    }
  }

  private assertOpen(exam: Exam) {
    if (![ExamStatus.REQUESTED, ExamStatus.IN_PROGRESS].includes(exam.status))
      throw new ConflictException(
        "Exames concluídos ou cancelados não podem ser alterados.",
      );
  }

  private writeAudit(
    manager: EntityManager,
    user: AuthenticatedUser,
    exam: Exam,
    action: AuditAction,
  ) {
    return this.audit.record(
      {
        actorId: user.sub,
        clinicId: exam.clinicId,
        action,
        resourceType: "Exam",
        resourceId: exam.id,
      },
      manager,
    );
  }

  private viewQuery(
    clinicId: string,
    professionalId: string,
    manager = this.exams.manager,
  ) {
    return manager
      .getRepository(Exam)
      .createQueryBuilder("exam")
      .select([
        "exam.id",
        "exam.clinicId",
        "exam.patientId",
        "exam.encounterId",
        "exam.examTypeId",
        "exam.requestedByProfessionalId",
        "exam.laterality",
        "exam.status",
        "exam.requestedAt",
        "exam.performedAt",
        "exam.completedAt",
        "exam.cancelledAt",
        "exam.createdAt",
        "exam.updatedAt",
      ])
      .innerJoin("exam.patient", "patient")
      .addSelect(["patient.id", "patient.name"])
      .innerJoin("exam.examType", "type")
      .addSelect(["type.id", "type.code", "type.name", "type.isActive"])
      .innerJoin("exam.requestedByProfessional", "professional")
      .addSelect([
        "professional.id",
        "professional.userId",
        "professional.crm",
        "professional.crmState",
      ])
      .innerJoin("professional.user", "user")
      .addSelect(["user.id", "user.name"])
      .leftJoin("exam.encounter", "encounter")
      .addSelect(["encounter.id", "encounter.startedAt"])
      .where("exam.clinicId = :clinicId", { clinicId })
      .andWhere("exam.requestedByProfessionalId = :professionalId", {
        professionalId,
      });
  }
}
