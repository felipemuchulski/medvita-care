import { Transform } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { BRAZILIAN_STATES } from "../constants/brazilian-states.constant";

export class CreateProfessionalDto {
  @IsUUID("4")
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  crm: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsIn(BRAZILIAN_STATES)
  crmState: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  rqe?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  specialty?: string;
}
