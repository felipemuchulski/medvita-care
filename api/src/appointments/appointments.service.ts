import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { AuditService } from "src/audit/audit.service";
import { AuditAction } from "src/audit/entities/audit-log.entity";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { isExclusionViolation } from "src/common/utils/database-error.util";
import { PatientsService } from "src/patients/patients.service";
import { ProfessionalsService } from "src/professionals/professionals.service";
import { CancelAppointmentDto } from "./dto/cancel-appointment.dto";
import { CheckAvailabilityQueryDto } from "./dto/check-availability-query.dto";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { ListAppointmentsQueryDto } from "./dto/list-appointments-query.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";
import { Appointment, AppointmentStatus } from "./entities/appointment.entity";
import { Encounter } from "src/encounters/entities/encounter.entity";

const OPEN_APPOINTMENT_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

const SCHEDULABLE_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
];

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
    private readonly patientsService: PatientsService,
    private readonly professionalsService: ProfessionalsService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    clinicId: string,
    dto: CreateAppointmentDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.RECEPTIONIST,
    ]);
    const { start, end, durationMinutes } = this.buildPeriod(
      dto.scheduledAt,
      dto.durationMinutes ?? 30,
      true,
    );
    await Promise.all([
      this.patientsService.findActiveForClinic(clinicId, dto.patientId),
      this.professionalsService.findActiveForClinic(
        clinicId,
        dto.professionalId,
      ),
    ]);

    try {
      const appointmentId =
        await this.appointmentsRepository.manager.transaction(
          async (manager) => {
            const repository = manager.getRepository(Appointment);
            await this.ensureNoConflict(
              repository,
              dto.professionalId,
              start,
              end,
            );
            const saved = await repository.save(
              repository.create({
                clinicId,
                patientId: dto.patientId,
                professionalId: dto.professionalId,
                scheduledAt: start,
                endsAt: end,
                durationMinutes,
                status: AppointmentStatus.SCHEDULED,
                reason: dto.reason?.trim() || null,
                notes: dto.notes?.trim() || null,
                cancellationReason: null,
                cancelledAt: null,
              }),
            );
            await this.auditService.record(
              {
                actorId: currentUser.sub,
                clinicId,
                action: AuditAction.APPOINTMENT_CREATED,
                resourceType: "Appointment",
                resourceId: saved.id,
                metadata: {
                  patientId: saved.patientId,
                  professionalId: saved.professionalId,
                  scheduledAt: saved.scheduledAt.toISOString(),
                  endsAt: saved.endsAt.toISOString(),
                },
              },
              manager,
            );
            return saved.id;
          },
        );
      return this.findById(clinicId, appointmentId, currentUser);
    } catch (error: unknown) {
      this.handleConflict(error);
      throw error;
    }
  }

  async findAll(
    clinicId: string,
    query: ListAppointmentsQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    const role = this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.RECEPTIONIST,
      ClinicUserRole.OPHTHALMOLOGIST,
    ]);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const builder = this.appointmentsRepository
      .createQueryBuilder("appointment")
      .innerJoinAndSelect("appointment.patient", "patient")
      .innerJoinAndSelect("appointment.professional", "professional")
      .innerJoinAndSelect("professional.user", "professionalUser")
      .where("appointment.clinic_id = :clinicId", { clinicId });

    if (role === ClinicUserRole.OPHTHALMOLOGIST) {
      builder.andWhere("professional.user_id = :currentUserId", {
        currentUserId: currentUser.sub,
      });
    }
    if (query.patientId) {
      builder.andWhere("appointment.patient_id = :patientId", {
        patientId: query.patientId,
      });
    }
    if (query.professionalId) {
      builder.andWhere("appointment.professional_id = :professionalId", {
        professionalId: query.professionalId,
      });
    }
    if (query.status) {
      builder.andWhere("appointment.status = :status", {
        status: query.status,
      });
    }
    if (query.from) {
      builder.andWhere("appointment.scheduled_at >= :from", {
        from: new Date(query.from),
      });
    }
    if (query.to) {
      builder.andWhere("appointment.scheduled_at <= :to", {
        to: new Date(query.to),
      });
    }

    const [data, total] = await builder
      .orderBy("appointment.scheduledAt", "ASC")
      .addOrderBy("appointment.id", "ASC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(clinicId: string, id: string, currentUser: AuthenticatedUser) {
    const role = this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.RECEPTIONIST,
      ClinicUserRole.OPHTHALMOLOGIST,
    ]);
    const builder = this.appointmentsRepository
      .createQueryBuilder("appointment")
      .innerJoinAndSelect("appointment.patient", "patient")
      .innerJoinAndSelect("appointment.professional", "professional")
      .innerJoinAndSelect("professional.user", "professionalUser")
      .leftJoinAndSelect("appointment.encounter", "encounter")
      .where("appointment.id = :id", { id })
      .andWhere("appointment.clinic_id = :clinicId", { clinicId });
    if (role === ClinicUserRole.OPHTHALMOLOGIST) {
      builder.andWhere("professional.user_id = :currentUserId", {
        currentUserId: currentUser.sub,
      });
    }
    const appointment = await builder.getOne();
    if (!appointment) {
      throw new NotFoundException(
        "Agendamento não encontrado na clínica informada.",
      );
    }
    return appointment;
  }

  async checkAvailability(
    clinicId: string,
    query: CheckAvailabilityQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    const role = this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.RECEPTIONIST,
      ClinicUserRole.OPHTHALMOLOGIST,
    ]);
    const profile = await this.professionalsService.findActiveForClinic(
      clinicId,
      query.professionalId,
    );
    if (
      role === ClinicUserRole.OPHTHALMOLOGIST &&
      profile.userId !== currentUser.sub
    ) {
      throw new ForbiddenException(
        "O profissional só pode consultar a própria disponibilidade.",
      );
    }
    const { start, end } = this.buildPeriod(
      query.scheduledAt,
      query.durationMinutes,
      false,
    );
    const conflict = await this.findConflict(
      this.appointmentsRepository,
      query.professionalId,
      start,
      end,
      query.excludeAppointmentId,
    );
    return {
      available: !conflict,
      period: { scheduledAt: start, endsAt: end },
      conflict:
        conflict?.clinicId === clinicId
          ? {
              appointmentId: conflict.id,
              scheduledAt: conflict.scheduledAt,
              endsAt: conflict.endsAt,
            }
          : null,
    };
  }

  async reschedule(
    clinicId: string,
    id: string,
    dto: RescheduleAppointmentDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.RECEPTIONIST,
    ]);
    try {
      await this.appointmentsRepository.manager.transaction(async (manager) => {
        const repository = manager.getRepository(Appointment);
        const appointment = await this.findLocked(repository, clinicId, id);
        this.assertSchedulable(appointment, "reagendar");
        await this.assertNoEncounter(manager, appointment.id, "reagendar");
        const previousScheduledAt = appointment.scheduledAt;
        const previousEndsAt = appointment.endsAt;
        const { start, end, durationMinutes } = this.buildPeriod(
          dto.scheduledAt,
          dto.durationMinutes ?? appointment.durationMinutes,
          true,
        );
        await this.ensureNoConflict(
          repository,
          appointment.professionalId,
          start,
          end,
          appointment.id,
        );
        appointment.scheduledAt = start;
        appointment.endsAt = end;
        appointment.durationMinutes = durationMinutes;
        appointment.status = AppointmentStatus.SCHEDULED;
        await repository.save(appointment);
        await this.auditService.record(
          {
            actorId: currentUser.sub,
            clinicId,
            action: AuditAction.APPOINTMENT_RESCHEDULED,
            resourceType: "Appointment",
            resourceId: appointment.id,
            metadata: {
              previousScheduledAt: previousScheduledAt.toISOString(),
              previousEndsAt: previousEndsAt.toISOString(),
              scheduledAt: start.toISOString(),
              endsAt: end.toISOString(),
            },
          },
          manager,
        );
      });
      return this.findById(clinicId, id, currentUser);
    } catch (error: unknown) {
      this.handleConflict(error);
      throw error;
    }
  }

  async cancel(
    clinicId: string,
    id: string,
    dto: CancelAppointmentDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.RECEPTIONIST,
    ]);
    await this.appointmentsRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Appointment);
      const appointment = await this.findLocked(repository, clinicId, id);
      this.assertSchedulable(appointment, "cancelar");
      await this.assertNoEncounter(manager, appointment.id, "cancelar");
      const previousStatus = appointment.status;
      appointment.status = AppointmentStatus.CANCELLED;
      appointment.cancellationReason = dto.reason;
      appointment.cancelledAt = new Date();
      await repository.save(appointment);
      await this.auditService.record(
        {
          actorId: currentUser.sub,
          clinicId,
          action: AuditAction.APPOINTMENT_CANCELLED,
          resourceType: "Appointment",
          resourceId: appointment.id,
          metadata: { previousStatus },
        },
        manager,
      );
    });
    return this.findById(clinicId, id, currentUser);
  }

  async findLockedForEncounter(
    manager: EntityManager,
    clinicId: string,
    appointmentId: string,
  ): Promise<Appointment> {
    const repository = manager.getRepository(Appointment);
    const appointment = await repository
      .createQueryBuilder("appointment")
      .innerJoinAndSelect("appointment.professional", "professional")
      .innerJoinAndSelect("professional.user", "professionalUser")
      .where("appointment.id = :appointmentId", { appointmentId })
      .andWhere("appointment.clinic_id = :clinicId", { clinicId })
      .setLock("pessimistic_write")
      .getOne();
    if (!appointment) {
      throw new NotFoundException(
        "Agendamento não encontrado na clínica informada.",
      );
    }
    return appointment;
  }

  saveWithManager(
    manager: EntityManager,
    appointment: Appointment,
  ): Promise<Appointment> {
    return manager.getRepository(Appointment).save(appointment);
  }

  private async findLocked(
    repository: Repository<Appointment>,
    clinicId: string,
    id: string,
  ): Promise<Appointment> {
    const appointment = await repository.findOne({
      where: { id, clinicId },
      lock: { mode: "pessimistic_write" },
    });
    if (!appointment) {
      throw new NotFoundException(
        "Agendamento não encontrado na clínica informada.",
      );
    }
    return appointment;
  }

  private assertSchedulable(appointment: Appointment, action: string): void {
    if (!SCHEDULABLE_STATUSES.includes(appointment.status)) {
      throw new BadRequestException(
        `Não é possível ${action} um agendamento no estado ${appointment.status}.`,
      );
    }
  }

  private async assertNoEncounter(
    manager: EntityManager,
    appointmentId: string,
    action: string,
  ): Promise<void> {
    if (await manager.getRepository(Encounter).existsBy({ appointmentId })) {
      throw new BadRequestException(
        `Não é possível ${action} um agendamento que já possui atendimento.`,
      );
    }
  }

  private buildPeriod(
    scheduledAt: string,
    durationMinutes: number,
    requireFuture: boolean,
  ) {
    const start = new Date(scheduledAt);
    if (!Number.isFinite(start.getTime())) {
      throw new BadRequestException("A data do agendamento é inválida.");
    }
    if (requireFuture && start <= new Date()) {
      throw new BadRequestException("O agendamento deve iniciar no futuro.");
    }
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    if (end <= start) {
      throw new BadRequestException(
        "O término do agendamento deve ser posterior ao início.",
      );
    }
    return { start, end, durationMinutes };
  }

  private async ensureNoConflict(
    repository: Repository<Appointment>,
    professionalId: string,
    start: Date,
    end: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    if (
      await this.findConflict(
        repository,
        professionalId,
        start,
        end,
        excludeAppointmentId,
      )
    ) {
      throw new ConflictException(
        "O profissional já possui um agendamento nesse período.",
      );
    }
  }

  private findConflict(
    repository: Repository<Appointment>,
    professionalId: string,
    start: Date,
    end: Date,
    excludeAppointmentId?: string,
  ): Promise<Appointment | null> {
    const builder = repository
      .createQueryBuilder("appointment")
      .where("appointment.professional_id = :professionalId", {
        professionalId,
      })
      .andWhere("appointment.status IN (:...statuses)", {
        statuses: OPEN_APPOINTMENT_STATUSES,
      })
      .andWhere("appointment.scheduled_at < :end", { end })
      .andWhere("appointment.ends_at > :start", { start });
    if (excludeAppointmentId) {
      builder.andWhere("appointment.id <> :excludeAppointmentId", {
        excludeAppointmentId,
      });
    }
    return builder.orderBy("appointment.scheduled_at", "ASC").getOne();
  }

  private assertClinicRole(
    currentUser: AuthenticatedUser,
    clinicId: string,
    allowedRoles: ClinicUserRole[],
  ): ClinicUserRole {
    const role = currentUser.clinicRoles.find(
      (membership) => membership.clinicId === clinicId,
    )?.role;
    if (!role || !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        "O usuário não possui permissão para esta operação na clínica.",
      );
    }
    return role;
  }

  private handleConflict(error: unknown): void {
    if (isExclusionViolation(error)) {
      throw new ConflictException(
        "O profissional já possui um agendamento nesse período.",
      );
    }
  }
}
