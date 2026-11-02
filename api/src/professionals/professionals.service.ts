import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { ClinicUsersService } from "src/clinic-users/clinic-users.service";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import { ClinicService } from "src/clinics/clinics.service";
import { isUniqueViolation } from "src/common/utils/database-error.util";
import { UserService } from "src/users/user.service";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { CreateProfessionalDto } from "./dto/create-professional.dto";
import { UpdateProfessionalDto } from "./dto/update-professional.dto";
import { ProfessionalProfile } from "./entities/professional-profile.entity";
import {
  normalizeProfessionalRegistration,
  normalizeProfessionalState,
  validateNormalizedRegistration,
} from "./professional-registration.util";

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(ProfessionalProfile)
    private readonly professionalsRepository: Repository<ProfessionalProfile>,
    private readonly clinicService: ClinicService,
    private readonly userService: UserService,
    private readonly clinicUsersService: ClinicUsersService,
  ) {}

  async create(
    clinicId: string,
    dto: CreateProfessionalDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertCanManage(currentUser, clinicId);
    await this.validateProfessionalEligibility(clinicId, dto.userId);

    const existingProfile = await this.professionalsRepository.findOneBy({
      userId: dto.userId,
    });
    if (existingProfile) {
      throw new ConflictException(
        "O usuário já possui um perfil profissional.",
      );
    }

    const crm = this.normalizeRequiredRegistration(dto.crm, "CRM");
    const crmState = normalizeProfessionalState(dto.crmState);
    await this.ensureUniqueCrm(crm, crmState);

    const profile = this.professionalsRepository.create({
      userId: dto.userId,
      crm,
      crmState,
      rqe: this.normalizeOptionalRegistration(dto.rqe),
      specialty: dto.specialty?.trim() || "Oftalmologia",
    });

    try {
      const savedProfile = await this.professionalsRepository.save(profile);
      return this.findById(clinicId, savedProfile.id, currentUser);
    } catch (error: unknown) {
      this.handleUniqueViolation(error);
      throw error;
    }
  }

  async findByClinic(clinicId: string, currentUser: AuthenticatedUser) {
    await this.validateActiveClinic(clinicId);
    const query = this.authorizedProfilesQuery(clinicId);
    this.applyReadScope(query, currentUser, clinicId);
    const profiles = await query
      .orderBy("user.name", "ASC")
      .addOrderBy("professional.id", "ASC")
      .getMany();

    return profiles.map((profile) => this.toResponse(profile));
  }

  async findById(clinicId: string, id: string, currentUser: AuthenticatedUser) {
    await this.validateActiveClinic(clinicId);
    const query = this.authorizedProfilesQuery(clinicId);
    this.applyReadScope(query, currentUser, clinicId);
    const profile = await query
      .andWhere("professional.id = :id", { id })
      .getOne();

    if (!profile) {
      throw new NotFoundException(
        "Perfil profissional não encontrado nesta clínica.",
      );
    }

    return this.toResponse(profile);
  }

  async findByUser(
    clinicId: string,
    userId: string,
    currentUser: AuthenticatedUser,
  ) {
    await this.validateActiveClinic(clinicId);
    this.assertCanReadUser(currentUser, clinicId, userId);
    const profile = await this.authorizedProfilesQuery(clinicId)
      .andWhere("professional.user_id = :userId", { userId })
      .getOne();

    if (!profile) {
      throw new NotFoundException(
        "Perfil profissional não encontrado para este usuário na clínica.",
      );
    }

    return this.toResponse(profile);
  }

  async findByCrm(
    clinicId: string,
    crmValue: string,
    crmStateValue: string,
    currentUser: AuthenticatedUser,
  ) {
    await this.validateActiveClinic(clinicId);
    const crm = this.normalizeRequiredRegistration(crmValue, "CRM");
    const crmState = normalizeProfessionalState(crmStateValue);
    const query = this.authorizedProfilesQuery(clinicId);
    this.applyReadScope(query, currentUser, clinicId);
    const profile = await query
      .andWhere("professional.crm = :crm", { crm })
      .andWhere("professional.crm_state = :crmState", { crmState })
      .getOne();

    if (!profile) {
      throw new NotFoundException(
        "Perfil profissional não encontrado para o CRM e a UF informados.",
      );
    }

    return this.toResponse(profile);
  }

  async update(
    clinicId: string,
    id: string,
    dto: UpdateProfessionalDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertCanManage(currentUser, clinicId);
    await this.validateActiveClinic(clinicId);
    const profile = await this.authorizedProfilesQuery(clinicId)
      .andWhere("professional.id = :id", { id })
      .getOne();

    if (!profile) {
      throw new NotFoundException(
        "Perfil profissional não encontrado nesta clínica.",
      );
    }

    const crm = dto.crm
      ? this.normalizeRequiredRegistration(dto.crm, "CRM")
      : profile.crm;
    const crmState = dto.crmState
      ? normalizeProfessionalState(dto.crmState)
      : profile.crmState;

    if (crm !== profile.crm || crmState !== profile.crmState) {
      await this.ensureUniqueCrm(crm, crmState, profile.id);
    }

    profile.crm = crm;
    profile.crmState = crmState;

    if (dto.rqe !== undefined) {
      profile.rqe = this.normalizeOptionalRegistration(dto.rqe);
    }
    if (dto.specialty !== undefined) {
      profile.specialty = dto.specialty.trim();
    }

    try {
      await this.professionalsRepository.save(profile);
      return this.findById(clinicId, profile.id, currentUser);
    } catch (error: unknown) {
      this.handleUniqueViolation(error);
      throw error;
    }
  }

  private async validateProfessionalEligibility(
    clinicId: string,
    userId: string,
  ): Promise<void> {
    const [clinic, user, membership] = await Promise.all([
      this.clinicService.findById(clinicId),
      this.userService.findById(userId),
      this.clinicUsersService.findActiveByClinicUserAndRole(
        clinicId,
        userId,
        ClinicUserRole.OPHTHALMOLOGIST,
      ),
    ]);

    if (!clinic.active) {
      throw new BadRequestException(
        "Não é possível cadastrar profissionais em uma clínica inativa.",
      );
    }
    if (!user.active) {
      throw new BadRequestException(
        "Não é possível cadastrar o perfil de um usuário inativo.",
      );
    }
    if (!membership) {
      throw new BadRequestException(
        "O usuário deve possuir um vínculo ativo de oftalmologista com a clínica.",
      );
    }
  }

  private async validateActiveClinic(clinicId: string): Promise<void> {
    const clinic = await this.clinicService.findById(clinicId);
    if (!clinic.active) {
      throw new BadRequestException("A clínica informada está inativa.");
    }
  }

  private authorizedProfilesQuery(
    clinicId: string,
  ): SelectQueryBuilder<ProfessionalProfile> {
    return this.professionalsRepository
      .createQueryBuilder("professional")
      .innerJoinAndSelect("professional.user", "user")
      .innerJoin(
        "user.clinicUsers",
        "membership",
        "membership.clinic_id = :clinicId AND membership.role = :role AND membership.active = true",
        { clinicId, role: ClinicUserRole.OPHTHALMOLOGIST },
      )
      .innerJoin("membership.clinic", "clinic", "clinic.active = true")
      .where("user.active = true");
  }

  private assertCanManage(
    currentUser: AuthenticatedUser,
    clinicId: string,
  ): void {
    if (currentUser.isSystemAdmin) return;

    const canManage = currentUser.clinicRoles.some(
      (membership) =>
        membership.clinicId === clinicId &&
        membership.role === ClinicUserRole.ADMIN,
    );

    if (!canManage) {
      throw new ForbiddenException(
        "O usuário não possui permissão para gerenciar profissionais nesta clínica.",
      );
    }
  }

  private applyReadScope(
    query: SelectQueryBuilder<ProfessionalProfile>,
    currentUser: AuthenticatedUser,
    clinicId: string,
  ): void {
    if (currentUser.isSystemAdmin) return;

    const role = currentUser.clinicRoles.find(
      (membership) => membership.clinicId === clinicId,
    )?.role;

    if (role === ClinicUserRole.ADMIN || role === ClinicUserRole.RECEPTIONIST) {
      return;
    }

    if (role === ClinicUserRole.OPHTHALMOLOGIST) {
      query.andWhere("professional.user_id = :currentUserId", {
        currentUserId: currentUser.sub,
      });
      return;
    }

    throw new ForbiddenException(
      "O usuário não possui permissão para consultar profissionais nesta clínica.",
    );
  }

  private assertCanReadUser(
    currentUser: AuthenticatedUser,
    clinicId: string,
    targetUserId: string,
  ): void {
    if (currentUser.isSystemAdmin) return;

    const role = currentUser.clinicRoles.find(
      (membership) => membership.clinicId === clinicId,
    )?.role;

    if (role === ClinicUserRole.ADMIN || role === ClinicUserRole.RECEPTIONIST) {
      return;
    }

    if (
      role === ClinicUserRole.OPHTHALMOLOGIST &&
      currentUser.sub === targetUserId
    ) {
      return;
    }

    throw new ForbiddenException(
      "O usuário não possui permissão para consultar este perfil profissional.",
    );
  }

  private normalizeRequiredRegistration(
    value: string,
    fieldName: "CRM" | "RQE",
  ): string {
    return validateNormalizedRegistration(
      normalizeProfessionalRegistration(value),
      fieldName,
    );
  }

  private normalizeOptionalRegistration(value?: string | null): string | null {
    if (value === undefined || value === null || !value.trim()) return null;

    return this.normalizeRequiredRegistration(value, "RQE");
  }

  private async ensureUniqueCrm(
    crm: string,
    crmState: string,
    currentProfileId?: string,
  ): Promise<void> {
    const existingProfile = await this.professionalsRepository.findOneBy({
      crm,
      crmState,
    });

    if (existingProfile && existingProfile.id !== currentProfileId) {
      throw new ConflictException(
        "Já existe um perfil profissional com este CRM e esta UF.",
      );
    }
  }

  private handleUniqueViolation(error: unknown): void {
    if (isUniqueViolation(error)) {
      throw new ConflictException(
        "Já existe um perfil para o usuário ou para o CRM e a UF informados.",
      );
    }
  }

  private toResponse(profile: ProfessionalProfile) {
    return {
      id: profile.id,
      userId: profile.userId,
      crm: profile.crm,
      crmState: profile.crmState,
      rqe: profile.rqe,
      specialty: profile.specialty,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      user: profile.user
        ? {
            id: profile.user.id,
            name: profile.user.name,
            email: profile.user.email,
            active: profile.user.active,
          }
        : undefined,
    };
  }
}
