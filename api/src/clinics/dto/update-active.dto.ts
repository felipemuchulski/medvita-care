import { IsBoolean, IsNotEmpty } from "class-validator";

export class UpdateActiveDto {
  @IsBoolean()
  @IsNotEmpty()
  active: boolean;
}
