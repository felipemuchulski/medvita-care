import { IsBoolean } from "class-validator";

export class UpdateActiveUserDto {
  @IsBoolean()
  active!: boolean;
}
