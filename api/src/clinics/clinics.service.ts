import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Clinic } from "./entities/clinic.entity";
import { Repository } from "typeorm";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { normalizedDocument } from "src/common/utils/normalize-document.util";
import { normalizedEmail } from "src/common/utils/normalize-email.utils";
import { UpdateClinicDto } from "./dto/update-clinic.dto";
import { UpdateActiveDto } from "./dto/update-active.dto";
import { isUniqueViolation } from "src/common/utils/database-error.util";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { ClinicUserRole } from "src/clinic-users/entities/clinic-user.entity";
import {
  assertAdministrativeClinicAccess,
  assertSystemAdmin,
} from "src/common/authorization/administrative-access";

@Injectable()
export class ClinicService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async create(createClinicDto: CreateClinicDto, user: AuthenticatedUser) {
    assertSystemAdmin(user);
    const documentNormalized = normalizedDocument(createClinicDto.document);
    const documentExist = await this.clinicRepository.findOneBy({
      document: documentNormalized,
    });

    const emailNormalized = createClinicDto.email
      ? normalizedEmail(createClinicDto.email)
      : undefined;

    if (documentExist) {
      throw new ConflictException(
        "Já existe uma clínica cadastrada com este documento.",
      );
    }

    const clinic = this.clinicRepository.create({
      ...createClinicDto,
      document: documentNormalized,
      email: emailNormalized,
    });

    try {
      return await this.clinicRepository.save(clinic);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "Já existe uma clínica cadastrada com este documento.",
        );
      }

      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    assertSystemAdmin(user);
    return await this.clinicRepository.find();
  }

  async findByDocument(document: string, user: AuthenticatedUser) {
    assertSystemAdmin(user);
    const documentNormalized = normalizedDocument(document);
    const documentClinic = await this.clinicRepository.findOneBy({
      document: documentNormalized,
    });

    if (!documentClinic) {
      throw new NotFoundException(
        `A clínica com o documento ${documentNormalized} não foi encontrada.`,
      );
    }

    return documentClinic;
  }

  async findByEmail(email: string) {
    const emailNormalized = normalizedEmail(email);
    const emailClinic = await this.clinicRepository.findOneBy({
      email: emailNormalized,
    });

    if (!emailClinic) {
      throw new NotFoundException(
        `A clínica com o email ${emailNormalized} não foi encontrada.`,
      );
    }

    return emailClinic;
  }

  async findById(id: string) {
    const clinic = await this.clinicRepository.findOneBy({ id });

    if (!clinic) {
      throw new NotFoundException(`Clínica com o id ${id} não foi encontrada.`);
    }

    return clinic;
  }

  async findByIdForUser(id: string, user: AuthenticatedUser) {
    assertAdministrativeClinicAccess(user, id, [
      ClinicUserRole.ADMIN,
      ClinicUserRole.OPHTHALMOLOGIST,
      ClinicUserRole.RECEPTIONIST,
    ]);
    return this.findById(id);
  }

  async updateClinic(
    id: string,
    updateClinicDto: UpdateClinicDto,
    user: AuthenticatedUser,
  ) {
    assertAdministrativeClinicAccess(user, id, [ClinicUserRole.ADMIN]);
    const clinic = await this.findById(id);

    if (updateClinicDto.email) {
      updateClinicDto.email = normalizedEmail(updateClinicDto.email);
    }

    Object.assign(clinic, updateClinicDto);
    return await this.clinicRepository.save(clinic);
  }

  async updateActive(
    id: string,
    updateActiveDto: UpdateActiveDto,
    user: AuthenticatedUser,
  ) {
    assertSystemAdmin(user);
    const clinic = await this.findById(id);
    clinic.active = updateActiveDto.active;

    return await this.clinicRepository.save(clinic);
  }
}
