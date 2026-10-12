import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { Repository } from "typeorm";
import { HashingService } from "src/common/hashing/hashing.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { normalizedEmail } from "src/common/utils/normalize-email.utils";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateActiveUserDto } from "./dto/update-active.dto";

// Adicionar role ao user após módulo de autenticação
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly hashingService: HashingService,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    const email = normalizedEmail(createUserDto.email);
    const userExist = await this.usersRepository.findOneBy({ email: email });

    if (userExist) {
      throw new ConflictException(
        "Já existe um usuário cadastrado com esse e-mail",
      );
    }

    const hashedPassword = await this.hashingService.hash(
      createUserDto.password,
    );

    const user = this.usersRepository.create({
      name: createUserDto.name,
      email: email,
      passwordHash: hashedPassword,
    });

    return await this.usersRepository.save(user);
  }

  async findAll(filters: { email?: string; active?: boolean }) {
    const where: Record<string, unknown> = {};

    if (filters.email) where.email = normalizedEmail(filters.email);
    if (filters.active !== undefined) where.active = filters.active;

    return await this.usersRepository.find({ where });
  }

  async findById(id: string) {
    const userId = await this.usersRepository.findOneBy({ id });

    if (!userId) {
      throw new NotFoundException("Não foi encontrado um usuário com este ID.");
    }

    return userId;
  }

  async findByEmail(email: string) {
    const emailNormalized = normalizedEmail(email);
    const userEmail = await this.usersRepository.findOneBy({
      email: emailNormalized,
    });

    if (!userEmail) {
      throw new NotFoundException(
        "Não foi encontrado um usuário com este e-mail.",
      );
    }

    return userEmail;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const userExist = await this.findById(id);

    if (updateUserDto.email) {
      const userEmail = normalizedEmail(updateUserDto.email);
      const userEmailExist = await this.usersRepository.findOneBy({
        email: userEmail,
      });

      if (userEmailExist && userEmailExist.id !== id) {
        throw new ConflictException(
          "Já existe um usuário cadastrado com este e-mail",
        );
      }

      updateUserDto.email = userEmail;
    }
    Object.assign(userExist, updateUserDto);
    return await this.usersRepository.save(userExist);
  }

  async updateActive(id: string, updateActiveDto: UpdateActiveUserDto) {
    const user = await this.findById(id);
    user.active = updateActiveDto.active;
    return await this.usersRepository.save(user);
  }

  async updatePassword(id: string, hashedPassword: string) {
    const user = await this.findById(id);
    user.passwordHash = hashedPassword;
    return await this.usersRepository.save(user);
  }
}
