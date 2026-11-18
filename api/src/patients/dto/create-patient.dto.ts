import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
} from "class-validator";
import { PatientSex } from "../entities/patient.entity";
import { IsCpf } from "../utils/is-cpf.validator";
import {
  normalizePatientName,
  isValidPatientPhone,
} from "../utils/patient-input.util";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

export class CreatePatientDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? normalizePatientName(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(3, {
    message: "O nome do paciente deve possuir ao menos 3 caracteres.",
  })
  @MaxLength(150, {
    message: "O nome do paciente deve possuir no máximo 150 caracteres.",
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @IsCpf()
  cpf?: string | null;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "birthDate deve usar o formato YYYY-MM-DD",
  })
  birthDate: string;

  @IsOptional()
  @IsEnum(PatientSex)
  sex?: PatientSex | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ValidateBy({
    name: "patientPhone",
    validator: {
      validate: isValidPatientPhone,
      defaultMessage: () =>
        "Informe um telefone brasileiro com 10 ou 11 dígitos.",
    },
  })
  phone?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, {
    message: "zipCode deve possuir um CEP válido",
  })
  zipCode?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  street?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  complement?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @Transform(uppercase)
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: "state deve possuir uma UF brasileira válida",
  })
  state?: string | null;
}
