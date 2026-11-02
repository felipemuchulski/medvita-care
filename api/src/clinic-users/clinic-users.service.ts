import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClinicService } from "src/clinics/clinics.service";
import { UserService } from "src/users/user.service";
import { isUniqueViolation } from "src/common/utils/database-error.util";
import { CreateClinicUserDto } from "./dto/create-clinic-user.dto";
import { UpdateClinicUserRoleDto } from "./dto/update-clinic-user-role.dto";
import { UpdateClinicUserActiveDto } from "./dto/update-clinic-user-active.dto";
import { ClinicUser, ClinicUserRole } from "./entities/clinic-user.entity";

@Injectable()
export class ClinicUsersService {
  constructor(
    @InjectRepository(ClinicUser)
    private readonly clinicUsersRepository: Repository<ClinicUser>,
    private readonly clinicService: ClinicService,
    private readonly userService: UserService,
  ) {}

  async create(clinicId: string, dto: CreateClinicUserDto) {
    const [clinic, user] = await Promise.all([
      this.clinicService.findById(clinicId),
      this.userService.findById(dto.userId),
    ]);

    if (!clinic.active) {
      throw new BadRequestException(
        "Não é possível criar vínculos em uma clínica inativa.",
      );
    }
    if (!user.active) {
      throw new BadRequestException(
        "Não é possível vincular um usuário inativo.",
      );
    }

    const existingMembership = await this.clinicUsersRepository.findOneBy({
      clinicId,
      userId: dto.userId,
    });
    if (existingMembership) {
      throw new ConflictException(
        "O usuário já possui um vínculo com esta clínica.",
      );
    }

    const activeAdminCount = await this.clinicUsersRepository.countBy({
      clinicId,
      role: ClinicUserRole.ADMIN,
      active: true,
    });
    if (activeAdminCount === 0 && dto.role !== ClinicUserRole.ADMIN) {
      throw new BadRequestException(
        "O primeiro vínculo ativo da clínica deve possuir o papel ADMIN.",
      );
    }

    const membership = this.clinicUsersRepository.create({
      clinicId,
      userId: dto.userId,
      role: dto.role,
      active: true,
    });

    try {
      return await this.clinicUsersRepository.save(membership);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "O usuário já possui um vínculo com esta clínica.",
        );
      }

      throw error;
    }
  }

  async findByClinic(clinicId: string) {
    await this.clinicService.findById(clinicId);

    const memberships = await this.clinicUsersRepository.find({
      where: { clinicId },
      relations: { user: true },
      order: { createdAt: "ASC" },
    });

    return memberships.map((membership) => ({
      id: membership.id,
      clinicId: membership.clinicId,
      userId: membership.userId,
      role: membership.role,
      active: membership.active,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      user: membership.user
        ? {
            id: membership.user.id,
            name: membership.user.name,
            email: membership.user.email,
            active: membership.user.active,
          }
        : undefined,
    }));
  }

  async findByUser(userId: string) {
    await this.userService.findById(userId);

    const memberships = await this.clinicUsersRepository.find({
      where: { userId },
      relations: { clinic: true },
      order: { createdAt: "ASC" },
    });

    return memberships.map((membership) => ({
      id: membership.id,
      clinicId: membership.clinicId,
      userId: membership.userId,
      role: membership.role,
      active: membership.active,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      clinic: membership.clinic
        ? {
            id: membership.clinic.id,
            name: membership.clinic.name,
            document: membership.clinic.document,
            active: membership.clinic.active,
          }
        : undefined,
    }));
  }

  async updateRole(
    clinicId: string,
    userId: string,
    dto: UpdateClinicUserRoleDto,
  ) {
    await Promise.all([
      this.clinicService.findById(clinicId),
      this.userService.findById(userId),
    ]);

    return this.clinicUsersRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ClinicUser);
      const activeAdmins = await this.lockActiveAdmins(repository, clinicId);
      const membership = await this.findMembershipForUpdate(
        repository,
        clinicId,
        userId,
      );

      if (
        membership.active &&
        membership.role === ClinicUserRole.ADMIN &&
        dto.role !== ClinicUserRole.ADMIN &&
        activeAdmins.length <= 1
      ) {
        throw new BadRequestException(
          "A clínica deve manter pelo menos um administrador ativo.",
        );
      }

      membership.role = dto.role;
      return repository.save(membership);
    });
  }

  async updateActive(
    clinicId: string,
    userId: string,
    dto: UpdateClinicUserActiveDto,
  ) {
    const [clinic, user] = await Promise.all([
      this.clinicService.findById(clinicId),
      this.userService.findById(userId),
    ]);

    if (dto.active && !clinic.active) {
      throw new BadRequestException(
        "Não é possível ativar vínculos em uma clínica inativa.",
      );
    }
    if (dto.active && !user.active) {
      throw new BadRequestException(
        "Não é possível ativar o vínculo de um usuário inativo.",
      );
    }

    return this.clinicUsersRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ClinicUser);
      const activeAdmins = await this.lockActiveAdmins(repository, clinicId);
      const membership = await this.findMembershipForUpdate(
        repository,
        clinicId,
        userId,
      );

      if (membership.active === dto.active) return membership;

      if (
        !dto.active &&
        membership.role === ClinicUserRole.ADMIN &&
        activeAdmins.length <= 1
      ) {
        throw new BadRequestException(
          "A clínica deve manter pelo menos um administrador ativo.",
        );
      }

      if (
        dto.active &&
        membership.role !== ClinicUserRole.ADMIN &&
        activeAdmins.length === 0
      ) {
        throw new BadRequestException(
          "Ative ou defina primeiro um administrador para esta clínica.",
        );
      }

      membership.active = dto.active;
      return repository.save(membership);
    });
  }

  private async findMembershipForUpdate(
    repository: Repository<ClinicUser>,
    clinicId: string,
    userId: string,
  ): Promise<ClinicUser> {
    const membership = await repository.findOne({
      where: { clinicId, userId },
      lock: { mode: "pessimistic_write" },
    });

    if (!membership) {
      throw new NotFoundException(
        "O usuário não possui vínculo com esta clínica.",
      );
    }

    return membership;
  }

  private lockActiveAdmins(
    repository: Repository<ClinicUser>,
    clinicId: string,
  ): Promise<ClinicUser[]> {
    return repository
      .createQueryBuilder("membership")
      .where("membership.clinic_id = :clinicId", { clinicId })
      .andWhere("membership.role = :role", { role: ClinicUserRole.ADMIN })
      .andWhere("membership.active = true")
      .orderBy("membership.id", "ASC")
      .setLock("pessimistic_write")
      .getMany();
  }
}
