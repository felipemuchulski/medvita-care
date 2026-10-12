import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { HashingService } from "src/common/hashing/hashing.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateActiveUserDto } from "./dto/update-active.dto";
import { UpdateUserPasswordDto } from "./dto/update-password.dto";

@Controller("users")
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly hashingService: HashingService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get()
  findAll(@Query("email") email?: string, @Query("active") active?: string) {
    return this.userService.findAll({
      email,
      active: active !== undefined ? active === "true" : undefined,
    });
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.userService.findById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Patch(":id/active")
  updateActive(
    @Param("id") id: string,
    @Body() updateActiveDto: UpdateActiveUserDto,
  ) {
    return this.userService.updateActive(id, updateActiveDto);
  }

  @Patch(":id/password")
  async updatePassword(
    @Param("id") id: string,
    @Body() dto: UpdateUserPasswordDto,
  ) {
    const user = await this.userService.findById(id);

    const isValid = await this.hashingService.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isValid) {
      throw new UnauthorizedException("Senha atual incorreta.");
    }

    const hashedPassword = await this.hashingService.hash(dto.newPassword);
    return this.userService.updatePassword(id, hashedPassword);
  }
}
