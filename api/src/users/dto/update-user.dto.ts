import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateUserDto {
  @IsString()
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @IsEmail()
  @MaxLength(150)
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  isSystemAdmin?: boolean;
}
