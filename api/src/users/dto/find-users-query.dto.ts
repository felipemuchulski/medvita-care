import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsOptional } from "class-validator";

function parseBoolean(value: unknown): unknown {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
}

export class FindUsersQueryDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseBoolean(value))
  @IsBoolean()
  active?: boolean;
}
