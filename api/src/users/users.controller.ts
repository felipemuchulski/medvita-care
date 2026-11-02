import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { HashingService } from "src/common/hashing/hashing.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateActiveUserDto } from "./dto/update-active.dto";
import { UpdateUserPasswordDto } from "./dto/update-password.dto";
import { SystemAdmin } from "src/common/decorators/system-admin.decorator";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthenticatedUser } from "src/auth/types/jwt-payload.type";
import { FindUsersQueryDto } from "./dto/find-users-query.dto";

@Controller("users")
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly hashingService: HashingService,
  ) {}

  @Post()
  @SystemAdmin()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get()
  @SystemAdmin()
  findAll(@Query() query: FindUsersQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(":id")
  @SystemAdmin()
  findById(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.userService.findById(id);
  }

  @Patch(":id")
  @SystemAdmin()
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Patch(":id/active")
  @SystemAdmin()
  updateActive(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateActiveDto: UpdateActiveUserDto,
  ) {
    return this.userService.updateActive(id, updateActiveDto);
  }

  @Patch(":id/password")
  async updatePassword(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserPasswordDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (currentUser.sub !== id && !currentUser.isSystemAdmin) {
      throw new ForbiddenException("Você só pode alterar a própria senha.");
    }

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
