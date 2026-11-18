import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { applyTextSearch } from "src/common/utils/text-search.util";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { ClinicService } from "src/clinics/clinics.service";
import { isUniqueViolation } from "src/common/utils/database-error.util";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { ListPatientsQueryDto } from "./dto/list-patients-query.dto";
import { UpdatePatientActiveDto } from "./dto/update-patient-active.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { Patient } from "./entities/patient.entity";
import { isFutureDateOnly, isValidDateOnly } from "./utils/date-only.util";
import { isValidCpf, normalizeCpf } from "./utils/cpf.util";
import { AuditService } from "src/audit/audit.service";
import { AuditAction } from "src/audit/entities/audit-log.entity";
import {
  normalizePatientName,
  isValidPatientPhone,
} from "./utils/patient-input.util";

const BRAZILIAN_STATES = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
    private readonly clinicService: ClinicService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    clinicId: string,
    dto: CreatePatientDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.RECEPTIONIST,
    ]);
    await this.validateActiveClinic(clinicId);

    const cpf = this.normalizeAndValidateCpf(dto.cpf);
    if (cpf) await this.ensureUniqueCpf(clinicId, cpf);

    const patient = this.patientsRepository.create({
      clinicId,
      name: this.normalizeRequiredName(dto.name),
      cpf,
      birthDate: this.validateBirthDate(dto.birthDate),
      sex: dto.sex ?? null,
      phone: this.normalizePhone(dto.phone),
      email: this.normalizeOptionalEmail(dto.email),
      zipCode: this.normalizeOptionalZipCode(dto.zipCode),
      street: this.normalizeOptionalText(dto.street),
      number: this.normalizeOptionalText(dto.number),
      complement: this.normalizeOptionalText(dto.complement),
      neighborhood: this.normalizeOptionalText(dto.neighborhood),
      city: this.normalizeOptionalText(dto.city),
      state: this.normalizeOptionalState(dto.state),
      active: true,
    });

    try {
      return await this.patientsRepository.manager.transaction(
        async (manager) => {
          const saved = await manager.getRepository(Patient).save(patient);
          await this.auditService.record(
            {
              actorId: currentUser.sub,
              clinicId,
              action: AuditAction.PATIENT_CREATED,
              resourceType: "Patient",
              resourceId: saved.id,
            },
            manager,
          );
          return saved;
        },
      );
    } catch (error: unknown) {
      this.handleUniqueViolation(error);
      throw error;
    }
  }

  async findAllByClinic(
    clinicId: string,
    query: ListPatientsQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.OPHTHALMOLOGIST,
      ClinicUserRole.RECEPTIONIST,
    ]);
    await this.validateActiveClinic(clinicId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const patientsQuery = this.patientsRepository
      .createQueryBuilder("patient")
      .where("patient.clinic_id = :clinicId", { clinicId });

    if (query.active !== undefined) {
      patientsQuery.andWhere("patient.active = :active", {
        active: query.active,
      });
    }

    applyTextSearch(
      patientsQuery,
      ["patient.name"],
      query.search,
      "patient.cpf",
    );

    const [data, total] = await patientsQuery
      .orderBy("patient.name", "ASC")
      .addOrderBy("patient.id", "ASC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    await this.auditService.recordSensitiveRead({
      actorId: currentUser.sub,
      clinicId,
      action: AuditAction.PATIENT_READ,
      resourceType: "PatientList",
      metadata: { resultCount: data.length, page },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(clinicId: string, id: string, currentUser: AuthenticatedUser) {
    this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.OPHTHALMOLOGIST,
      ClinicUserRole.RECEPTIONIST,
    ]);
    await this.validateActiveClinic(clinicId);
    const patient = await this.findPatientInClinic(clinicId, id);
    await this.auditService.recordSensitiveRead({
      actorId: currentUser.sub,
      clinicId,
      action: AuditAction.PATIENT_READ,
      resourceType: "Patient",
      resourceId: patient.id,
    });
    return patient;
  }

  async update(
    clinicId: string,
    id: string,
    dto: UpdatePatientDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertClinicRole(currentUser, clinicId, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.RECEPTIONIST,
    ]);
    await this.validateActiveClinic(clinicId);
    const patient = await this.findPatientInClinic(clinicId, id);

    if (dto.name !== undefined) {
      patient.name = this.normalizeRequiredName(dto.name);
    }
    if (dto.cpf !== undefined) {
      const cpf = this.normalizeAndValidateCpf(dto.cpf);
      if (cpf && cpf !== patient.cpf) {
        await this.ensureUniqueCpf(clinicId, cpf, patient.id);
      }
      patient.cpf = cpf;
    }
    if (dto.birthDate !== undefined) {
      patient.birthDate = this.validateBirthDate(dto.birthDate);
    }
    if (dto.sex !== undefined) patient.sex = dto.sex ?? null;
    if (dto.phone !== undefined) {
      patient.phone = this.normalizePhone(dto.phone);
    }
    if (dto.email !== undefined) {
      patient.email = this.normalizeOptionalEmail(dto.email);
    }
    if (dto.zipCode !== undefined) {
      patient.zipCode = this.normalizeOptionalZipCode(dto.zipCode);
    }
    if (dto.street !== undefined) {
      patient.street = this.normalizeOptionalText(dto.street);
    }
    if (dto.number !== undefined) {
      patient.number = this.normalizeOptionalText(dto.number);
    }
    if (dto.complement !== undefined) {
      patient.complement = this.normalizeOptionalText(dto.complement);
    }
    if (dto.neighborhood !== undefined) {
      patient.neighborhood = this.normalizeOptionalText(dto.neighborhood);
    }
    if (dto.city !== undefined) {
      patient.city = this.normalizeOptionalText(dto.city);
    }
    if (dto.state !== undefined) {
      patient.state = this.normalizeOptionalState(dto.state);
    }

    try {
      return await this.patientsRepository.manager.transaction(
        async (manager) => {
          const saved = await manager.getRepository(Patient).save(patient);
          await this.auditService.record(
            {
              actorId: currentUser.sub,
              clinicId,
              action: AuditAction.PATIENT_UPDATED,
              resourceType: "Patient",
              resourceId: saved.id,
              metadata: { changedFields: Object.keys(dto) },
            },
            manager,
          );
          return saved;
        },
      );
    } catch (error: unknown) {
      this.handleUniqueViolation(error);
      throw error;
    }
  }

  async updateActive(
    clinicId: string,
    id: string,
    dto: UpdatePatientActiveDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertClinicRole(currentUser, clinicId, [ClinicUserRole.ADMIN]);
    await this.validateActiveClinic(clinicId);
    const patient = await this.findPatientInClinic(clinicId, id);
    patient.active = dto.active;
    return this.patientsRepository.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(Patient).save(patient);
      await this.auditService.record(
        {
          actorId: currentUser.sub,
          clinicId,
          action: AuditAction.PATIENT_STATUS_CHANGED,
          resourceType: "Patient",
          resourceId: saved.id,
          metadata: { active: saved.active },
        },
        manager,
      );
      return saved;
    });
  }

  async findActiveForClinic(clinicId: string, id: string): Promise<Patient> {
    await this.validateActiveClinic(clinicId);
    const patient = await this.patientsRepository.findOneBy({
      id,
      clinicId,
      active: true,
    });

    if (!patient) {
      throw new NotFoundException(
        "Paciente ativo não encontrado na clínica informada.",
      );
    }

    return patient;
  }

  private async findPatientInClinic(
    clinicId: string,
    id: string,
  ): Promise<Patient> {
    const patient = await this.patientsRepository.findOneBy({ id, clinicId });

    if (!patient) {
      throw new NotFoundException(
        "Paciente não encontrado na clínica informada.",
      );
    }

    return patient;
  }

  private async validateActiveClinic(clinicId: string): Promise<void> {
    const clinic = await this.clinicService.findById(clinicId);
    if (!clinic.active) {
      throw new BadRequestException("A clínica informada está inativa.");
    }
  }

  private assertClinicRole(
    currentUser: AuthenticatedUser,
    clinicId: string,
    allowedRoles: ClinicUserRole[],
  ): void {
    const role = currentUser.clinicRoles.find(
      (membership) => membership.clinicId === clinicId,
    )?.role;

    if (!role || !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        "O usuário não possui permissão para esta operação na clínica.",
      );
    }
  }

  private normalizeAndValidateCpf(value?: string | null): string | null {
    if (value === undefined || value === null || !value.trim()) return null;

    const cpf = normalizeCpf(value);
    if (!/^[\d.\-\s]+$/.test(value) || !isValidCpf(cpf)) {
      throw new BadRequestException("O CPF informado é inválido.");
    }

    return cpf;
  }

  private validateBirthDate(value: string): string {
    if (
      typeof value !== "string" ||
      !isValidDateOnly(value) ||
      isFutureDateOnly(value)
    ) {
      throw new BadRequestException(
        "A data de nascimento deve ser válida, usar YYYY-MM-DD e não ser futura.",
      );
    }

    return value;
  }

  private normalizeRequiredName(value: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("O nome do paciente é obrigatório.");
    }

    const name = normalizePatientName(value);
    if (Array.from(name).length < 3 || name.length > 150) {
      throw new BadRequestException(
        "O nome do paciente deve possuir de 3 a 150 caracteres.",
      );
    }
    return name;
  }

  private normalizePhone(value?: string | null): string | null {
    const phone = this.normalizeOptionalText(value);
    if (phone && (phone.length > 20 || !isValidPatientPhone(phone))) {
      throw new BadRequestException(
        "Informe um telefone brasileiro com 10 ou 11 dígitos.",
      );
    }
    // Preserve the existing trimmed text representation, including punctuation.
    return phone;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null || !value.trim()) return null;
    return value.trim();
  }

  private normalizeOptionalEmail(value?: string | null): string | null {
    const email = this.normalizeOptionalText(value);
    return email?.toLowerCase() ?? null;
  }

  private normalizeOptionalZipCode(value?: string | null): string | null {
    if (value === undefined || value === null || !value.trim()) return null;
    const zipCode = value.replace(/\D/g, "");
    if (zipCode.length !== 8) {
      throw new BadRequestException("O CEP informado é inválido.");
    }
    return zipCode;
  }

  private normalizeOptionalState(value?: string | null): string | null {
    if (value === undefined || value === null || !value.trim()) return null;
    const state = value.trim().toUpperCase();
    if (!BRAZILIAN_STATES.has(state)) {
      throw new BadRequestException("A UF informada é inválida.");
    }
    return state;
  }

  private async ensureUniqueCpf(
    clinicId: string,
    cpf: string,
    currentPatientId?: string,
  ): Promise<void> {
    const existingPatient = await this.patientsRepository.findOneBy({
      clinicId,
      cpf,
    });

    if (existingPatient && existingPatient.id !== currentPatientId) {
      throw new ConflictException(
        "Já existe um paciente com este CPF nesta clínica.",
      );
    }
  }

  private handleUniqueViolation(error: unknown): void {
    if (isUniqueViolation(error)) {
      throw new ConflictException(
        "Já existe um paciente com este CPF nesta clínica.",
      );
    }
  }
}
