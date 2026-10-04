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

@Injectable()
export class ClinicService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async create(createClinicDto: CreateClinicDto) {
    const documentNormalized = normalizedDocument(createClinicDto.document);
    const documentExist = await this.clinicRepository.findOneBy({
      document: documentNormalized,
    });

    const emailNormalized = normalizedEmail(createClinicDto.email);
    const emailExist = await this.clinicRepository.findOneBy({
      email: emailNormalized,
    });

    if (documentExist) {
      throw new ConflictException(
        "Já existe uma clínica cadastrada com este documento.",
      );
    }

    if (emailExist) {
      throw new ConflictException(
        "Já existe uma clínica cadastrada com este email.",
      );
    }

    const clinic = this.clinicRepository.create({
      ...createClinicDto,
      document: documentNormalized,
    });

    return await this.clinicRepository.save(clinic);
  }

  async findAll() {
    return await this.clinicRepository.find();
  }

  async findByDocument(document: string) {
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

  async updateClinic(id: string, updateClinicDto: UpdateClinicDto) {
    const clinic = await this.findById(id);

    if (updateClinicDto.email) {
      const emailNormalized = normalizedEmail(updateClinicDto.email);
      const emailExist = await this.clinicRepository.findOneBy({
        email: emailNormalized,
      });

      if (emailExist && emailExist.id !== id) {
        throw new ConflictException(
          "Já existe uma clínica cadastrada com este email.",
        );
      }

      updateClinicDto.email = emailNormalized;
    }

    Object.assign(clinic, updateClinicDto);
    return await this.clinicRepository.save(clinic);
  }

  async updateActive(id: string, updateActiveDto: UpdateActiveDto) {
    const clinic = await this.findById(id);
    clinic.active = updateActiveDto.active;

    return await this.clinicRepository.save(clinic);
  }
}
