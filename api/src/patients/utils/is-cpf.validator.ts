import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";
import { isValidCpf } from "./cpf.util";

export function IsCpf(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: "isCpf",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === "string" &&
            /^[\d.\-\s]+$/.test(value) &&
            isValidCpf(value)
          );
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} deve ser um CPF válido`;
        },
      },
    });
  };
}
