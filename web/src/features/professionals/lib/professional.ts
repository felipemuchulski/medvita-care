import { z } from "zod";
import { isApiError } from "../../../api/api-error";
import type { ClinicRole } from "../../auth/types/auth";
import type {
  Professional,
  ProfessionalMembership,
} from "../types/professional";
export const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export const normalizeRegistration = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const registration = z
  .string()
  .max(20, "Use no máximo 20 caracteres.")
  .transform(normalizeRegistration)
  .refine((v) => v.length > 0, "Informe letras ou números válidos.");
export const professionalSchema = z.object({
  crm: registration,
  crmState: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (v) => (states as readonly string[]).includes(v),
      "Selecione uma UF válida.",
    ),
  rqe: z
    .string()
    .max(20, "Use no máximo 20 caracteres.")
    .refine(
      (v) => !v.trim() || Boolean(normalizeRegistration(v)),
      "Informe um RQE válido.",
    )
    .transform((v) => normalizeRegistration(v) || null),
  specialty: z
    .string()
    .trim()
    .min(1, "Informe a especialidade.")
    .max(100, "Use no máximo 100 caracteres."),
});
export type ProfessionalFormValues = z.input<typeof professionalSchema>;
export const canCreateProfessionals = (
  role: ClinicRole | null,
  isSystemAdmin = false,
) => isSystemAdmin || role === "ADMIN";
export const canEditProfessionals = (isSystemAdmin = false) => isSystemAdmin;
export const professionalEditDeniedMessage =
  "Acesso restrito a administradores do sistema.";
export function eligibleMembers(
  members: ProfessionalMembership[],
  profiles: Professional[],
  clinic: string,
) {
  const existing = new Set(profiles.map((p) => p.userId));
  return members.filter(
    (m) =>
      m.clinicId === clinic &&
      m.active &&
      m.role === "OPHTHALMOLOGIST" &&
      m.user?.active &&
      !existing.has(m.userId),
  );
}
export function searchProfessionals(
  profiles: Professional[],
  search: string,
  state: string,
) {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const term = normalize(search.trim());
  return profiles.filter(
    (p) =>
      (!state || p.crmState === state) &&
      (!term ||
        normalize(
          `${p.user.name} ${p.crm} ${p.crmState} ${p.rqe ?? ""} ${p.specialty}`,
        ).includes(term)),
  );
}
export function professionalError(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 409)
      return "Já existe um perfil para este usuário ou CRM/UF. Consulte o cadastro existente.";
    if (error.status === 403)
      return error.message;
    if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (error.status === 404)
      return "Profissional ou vínculo não encontrado nesta clínica.";
    if (error.status === 400)
      return "Verifique os dados, a situação da clínica e o vínculo ativo de oftalmologista do usuário.";
  }
  return "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
}
