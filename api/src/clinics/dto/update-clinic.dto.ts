import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateClinicDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
