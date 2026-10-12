import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class UpdateUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword!: string;
}
