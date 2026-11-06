import { isApiError } from "../../../api/api-error";
import type { ClinicRole } from "../../auth/types/auth";
import type { Appointment } from "../types/appointment";
// No clinic timezone is exposed by the API. Use an explicit operational offset, never the browser timezone.
export const defaultOffset = "-03:00";
export const statusLabels = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};
export function canManage(role: ClinicRole | null) {
  return role === "ADMIN" || role === "RECEPTIONIST";
}
export function canChange(a: Appointment) {
  return ["SCHEDULED", "CONFIRMED"].includes(a.status) && !a.encounter;
}
export function toIso(local: string, offset: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ||
    !/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/.test(offset)
  )
    throw new Error("Informe data, horário e fuso válidos.");
  const value = `${local}:00${offset}`;
  if (
    !Number.isFinite(Date.parse(value)) ||
    localInOffset(value, offset) !== local
  )
    throw new Error("Data inválida.");
  return value;
}
export function localInOffset(iso: string, offset = defaultOffset) {
  const sign = offset[0] === "-" ? -1 : 1;
  const minutes =
    sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4)));
  return new Date(Date.parse(iso) + minutes * 60000).toISOString().slice(0, 16);
}
export function formatAppointment(iso: string, offset = defaultOffset) {
  const [date, time] = localInOffset(iso, offset).split("T");
  return `${date.split("-").reverse().join("/")} às ${time}`;
}
export function appointmentError(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 409)
      return "O profissional já possui um agendamento nesse período. Escolha outro horário.";
    if ([401, 403, 404].includes(error.status))
      return (
        {
          401: "Sessão expirada. Entre novamente.",
          403: "Você não tem permissão para esta operação.",
          404: "Agendamento não encontrado nesta clínica.",
        }[error.status] ?? "Não foi possível concluir a operação."
      );
    if (error.status === 400)
      return "Verifique os dados. O agendamento deve ser futuro e permitir esta alteração, sem atendimento vinculado.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}
