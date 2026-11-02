import { BadRequestException } from "@nestjs/common";
import { BRAZILIAN_STATES } from "./constants/brazilian-states.constant";

export function normalizeProfessionalRegistration(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeProfessionalState(value: string): string {
  const state = value.trim().toUpperCase();

  if (!(BRAZILIAN_STATES as readonly string[]).includes(state)) {
    throw new BadRequestException("A UF do CRM informada é inválida.");
  }

  return state;
}

export function validateNormalizedRegistration(
  value: string,
  fieldName: "CRM" | "RQE",
): string {
  if (!value) {
    throw new BadRequestException(`O ${fieldName} informado é inválido.`);
  }

  if (value.length > 20) {
    throw new BadRequestException(
      `O ${fieldName} deve possuir no máximo 20 caracteres normalizados.`,
    );
  }

  return value;
}
