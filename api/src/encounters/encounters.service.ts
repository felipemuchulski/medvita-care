import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository, SelectQueryBuilder } from "typeorm";
import { AppointmentsService } from "src/appointments/appointments.service";
import { AppointmentStatus } from "src/appointments/entities/appointment.entity";
import { AuditService } from "src/audit/audit.service";
import { AuditAction } from "src/audit/entities/audit-log.entity";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { isUniqueViolation } from "src/common/utils/database-error.util";
import { CancelEncounterDto } from "./dto/cancel-encounter.dto";
import { ListEncountersQueryDto } from "./dto/list-encounters-query.dto";
import { StartEncounterDto } from "./dto/start-encounter.dto";
import { UpdateEncounterDto } from "./dto/update-encounter.dto";
import { Encounter, EncounterStatus } from "./entities/encounter.entity";

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encountersRepository: Repository<Encounter>,
    private readonly appointmentsService: AppointmentsService,
    private readonly auditService: AuditService,
  ) {}

  async start(
    clinicId: string,
    dto: StartEncounterDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertOphthalmologist(currentUser, clinicId);
    try {
      const encounterId = await this.encountersRepository.manager.transaction(
        async (manager) => {
          const appointment =
            await this.appointmentsService.findLockedForEncounter(
              manager,
              clinicId,
              dto.appointmentId,
            );
          this.assertAssignedProfessional(
            appointment.professional.userId,
            currentUser,
          );
          if (
            ![
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
            ].includes(appointment.status)
          ) {
            throw new BadRequestException(
              `O atendimento não pode ser iniciado a partir do estado ${appointment.status}.`,
            );
          }
          const repository = manager.getRepository(Encounter);
          if (await repository.existsBy({ appointmentId: appointment.id })) {
            throw new ConflictException(
              "O agendamento já possui um atendimento.",
            );
          }

          const encounter = await repository.save(
            repository.create({
              clinicId,
              patientId: appointment.patientId,
              professionalId: appointment.professionalId,
              appointmentId: appointment.id,
              status: EncounterStatus.IN_PROGRESS,
              startedAt: new Date(),
              finishedAt: null,
              clinicalNotes: null,
              chiefComplaint: null,
              anamnesis: null,
              visualAcuityRight: null,
              visualAcuityLeft: null,
              intraocularPressureRight: null,
              intraocularPressureLeft: null,
              clinicalAssessment: null,
              plan: null,
              cancellationReason: null,
            }),
          );
          appointment.status = AppointmentStatus.IN_PROGRESS;
          await this.appointmentsService.saveWithManager(manager, appointment);
          await this.auditService.record(
            {
              actorId: currentUser.sub,
              clinicId,
              action: AuditAction.ENCOUNTER_STARTED,
              resourceType: "Encounter",
              resourceId: encounter.id,
              metadata: {
                appointmentId: appointment.id,
                patientId: appointment.patientId,
                professionalId: appointment.professionalId,
              },
            },
            manager,
          );
          return encounter.id;
        },
      );
      return this.findById(clinicId, encounterId, currentUser);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("O agendamento já possui um atendimento.");
      }
      throw error;
    }
  }

  async findAll(
    clinicId: string,
    query: ListEncountersQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertOphthalmologist(currentUser, clinicId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const builder = this.authorizedQuery(clinicId, currentUser.sub);
    this.applyFilters(builder, query);
    const [data, total] = await builder
      .orderBy("encounter.startedAt", "DESC")
      .addOrderBy("encounter.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    await this.auditService.recordSensitiveRead({
      actorId: currentUser.sub,
      clinicId,
      action: AuditAction.ENCOUNTER_READ,
      resourceType: "EncounterList",
      metadata: { resultCount: data.length, page },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(clinicId: string, id: string, currentUser: AuthenticatedUser) {
    this.assertOphthalmologist(currentUser, clinicId);
    const encounter = await this.authorizedQuery(clinicId, currentUser.sub)
      .andWhere("encounter.id = :id", { id })
      .getOne();
    if (!encounter) {
      throw new NotFoundException(
        "Atendimento não encontrado ou não autorizado nesta clínica.",
      );
    }
    await this.auditService.recordSensitiveRead({
      actorId: currentUser.sub,
      clinicId,
      action: AuditAction.ENCOUNTER_READ,
      resourceType: "Encounter",
      resourceId: encounter.id,
      metadata: { patientId: encounter.patientId },
    });
    return encounter;
  }

  async findPatientHistory(
    clinicId: string,
    patientId: string,
    query: ListEncountersQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertOphthalmologist(currentUser, clinicId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const builder = this.clinicQuery(clinicId).andWhere(
      "encounter.patient_id = :patientId",
      { patientId },
    );
    this.applyFilters(builder, { ...query, patientId: undefined });
    const [data, total] = await builder
      .orderBy("encounter.startedAt", "DESC")
      .addOrderBy("encounter.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    await this.auditService.recordSensitiveRead({
      actorId: currentUser.sub,
      clinicId,
      action: AuditAction.ENCOUNTER_READ,
      resourceType: "PatientEncounterHistory",
      resourceId: patientId,
      metadata: { resultCount: data.length, page },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(
    clinicId: string,
    id: string,
    dto: UpdateEncounterDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertOphthalmologist(currentUser, clinicId);
    await this.encountersRepository.manager.transaction(async (manager) => {
      const encounter = await this.findLocked(
        manager,
        clinicId,
        id,
        currentUser.sub,
      );
      this.assertInProgress(encounter, "alterar");
      this.applyClinicalData(encounter, dto);
      await manager.getRepository(Encounter).save(encounter);
      await this.auditService.record(
        {
          actorId: currentUser.sub,
          clinicId,
          action: AuditAction.ENCOUNTER_UPDATED,
          resourceType: "Encounter",
          resourceId: encounter.id,
          metadata: { changedFields: Object.keys(dto) },
        },
        manager,
      );
    });
    return this.findById(clinicId, id, currentUser);
  }

  async complete(
    clinicId: string,
    id: string,
    dto: UpdateEncounterDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertOphthalmologist(currentUser, clinicId);
    await this.encountersRepository.manager.transaction(async (manager) => {
      const encounter = await this.findLocked(
        manager,
        clinicId,
        id,
        currentUser.sub,
      );
      this.assertInProgress(encounter, "concluir");
      this.applyClinicalData(encounter, dto);
      this.assertCompletionData(encounter);
      encounter.status = EncounterStatus.COMPLETED;
      encounter.finishedAt = new Date();
      await manager.getRepository(Encounter).save(encounter);

      const appointment = await this.appointmentsService.findLockedForEncounter(
        manager,
        clinicId,
        encounter.appointmentId,
      );
      if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
        throw new BadRequestException(
          "O agendamento vinculado não está em atendimento.",
        );
      }
      appointment.status = AppointmentStatus.COMPLETED;
      await this.appointmentsService.saveWithManager(manager, appointment);
      await this.auditService.record(
        {
          actorId: currentUser.sub,
          clinicId,
          action: AuditAction.ENCOUNTER_COMPLETED,
          resourceType: "Encounter",
          resourceId: encounter.id,
          metadata: { appointmentId: encounter.appointmentId },
        },
        manager,
      );
      await this.auditService.record(
        {
          actorId: currentUser.sub,
          clinicId,
          action: AuditAction.APPOINTMENT_COMPLETED,
          resourceType: "Appointment",
          resourceId: appointment.id,
          metadata: { encounterId: encounter.id },
        },
        manager,
      );
    });
    return this.findById(clinicId, id, currentUser);
  }

  async cancel(
    clinicId: string,
    id: string,
    dto: CancelEncounterDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertOphthalmologist(currentUser, clinicId);
    await this.encountersRepository.manager.transaction(async (manager) => {
      const encounter = await this.findLocked(
        manager,
        clinicId,
        id,
        currentUser.sub,
      );
      this.assertInProgress(encounter, "cancelar");
      encounter.status = EncounterStatus.CANCELLED;
      encounter.finishedAt = new Date();
      encounter.cancellationReason = dto.reason;
      await manager.getRepository(Encounter).save(encounter);

      const appointment = await this.appointmentsService.findLockedForEncounter(
        manager,
        clinicId,
        encounter.appointmentId,
      );
      appointment.status = AppointmentStatus.CANCELLED;
      appointment.cancellationReason = dto.reason;
      appointment.cancelledAt = new Date();
      await this.appointmentsService.saveWithManager(manager, appointment);
      await this.auditService.record(
        {
          actorId: currentUser.sub,
          clinicId,
          action: AuditAction.ENCOUNTER_CANCELLED,
          resourceType: "Encounter",
          resourceId: encounter.id,
          metadata: { appointmentId: encounter.appointmentId },
        },
        manager,
      );
      await this.auditService.record(
        {
          actorId: currentUser.sub,
          clinicId,
          action: AuditAction.APPOINTMENT_CANCELLED,
          resourceType: "Appointment",
          resourceId: appointment.id,
          metadata: { encounterId: encounter.id },
        },
        manager,
      );
    });
    return this.findById(clinicId, id, currentUser);
  }

  private authorizedQuery(
    clinicId: string,
    currentUserId: string,
  ): SelectQueryBuilder<Encounter> {
    return this.clinicQuery(clinicId).andWhere(
      "professional.user_id = :currentUserId",
      { currentUserId },
    );
  }

  private clinicQuery(clinicId: string): SelectQueryBuilder<Encounter> {
    return this.encountersRepository
      .createQueryBuilder("encounter")
      .innerJoinAndSelect("encounter.patient", "patient")
      .innerJoinAndSelect("encounter.professional", "professional")
      .innerJoinAndSelect("professional.user", "professionalUser")
      .innerJoinAndSelect("encounter.appointment", "appointment")
      .where("encounter.clinic_id = :clinicId", { clinicId });
  }

  private applyFilters(
    builder: SelectQueryBuilder<Encounter>,
    query: ListEncountersQueryDto,
  ): void {
    if (query.patientId) {
      builder.andWhere("encounter.patient_id = :patientId", {
        patientId: query.patientId,
      });
    }
    if (query.professionalId) {
      builder.andWhere("encounter.professional_id = :professionalId", {
        professionalId: query.professionalId,
      });
    }
    if (query.status) {
      builder.andWhere("encounter.status = :status", { status: query.status });
    }
    if (query.from) {
      builder.andWhere("encounter.started_at >= :from", {
        from: new Date(query.from),
      });
    }
    if (query.to) {
      builder.andWhere("encounter.started_at <= :to", {
        to: new Date(query.to),
      });
    }
  }

  private async findLocked(
    manager: EntityManager,
    clinicId: string,
    id: string,
    currentUserId: string,
  ): Promise<Encounter> {
    const encounter = await manager
      .getRepository(Encounter)
      .createQueryBuilder("encounter")
      .innerJoinAndSelect("encounter.professional", "professional")
      .innerJoinAndSelect("professional.user", "professionalUser")
      .where("encounter.id = :id", { id })
      .andWhere("encounter.clinic_id = :clinicId", { clinicId })
      .andWhere("professional.user_id = :currentUserId", { currentUserId })
      .setLock("pessimistic_write")
      .getOne();
    if (!encounter) {
      throw new NotFoundException(
        "Atendimento não encontrado ou não autorizado nesta clínica.",
      );
    }
    return encounter;
  }

  private applyClinicalData(
    encounter: Encounter,
    dto: UpdateEncounterDto,
  ): void {
    const fields: (keyof UpdateEncounterDto)[] = [
      "chiefComplaint",
      "anamnesis",
      "visualAcuityRight",
      "visualAcuityLeft",
      "intraocularPressureRight",
      "intraocularPressureLeft",
      "clinicalAssessment",
      "plan",
      "clinicalNotes",
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) {
        Object.assign(encounter, { [field]: dto[field] });
      }
    }
  }

  private assertCompletionData(encounter: Encounter): void {
    if (
      !encounter.chiefComplaint?.trim() ||
      !encounter.clinicalAssessment?.trim() ||
      !encounter.plan?.trim()
    ) {
      throw new BadRequestException(
        "Queixa principal, avaliação clínica e plano são obrigatórios para concluir.",
      );
    }
  }

  private assertInProgress(encounter: Encounter, action: string): void {
    if (encounter.status !== EncounterStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Não é possível ${action} um atendimento no estado ${encounter.status}.`,
      );
    }
  }

  private assertOphthalmologist(
    currentUser: AuthenticatedUser,
    clinicId: string,
  ): void {
    const role = currentUser.clinicRoles.find(
      (membership) => membership.clinicId === clinicId,
    )?.role;
    if (role !== ClinicUserRole.OPHTHALMOLOGIST) {
      throw new ForbiddenException(
        "Os dados clínicos são restritos ao oftalmologista vinculado.",
      );
    }
  }

  private assertAssignedProfessional(
    professionalUserId: string,
    currentUser: AuthenticatedUser,
  ): void {
    if (professionalUserId !== currentUser.sub) {
      throw new ForbiddenException(
        "Somente o profissional designado pode iniciar este atendimento.",
      );
    }
  }
}
