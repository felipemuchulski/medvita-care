import { httpClient } from "../../../api/http-client";
import type {
  CreateProfessionalPayload,
  Professional,
  ProfessionalFields,
  ProfessionalMembership,
} from "../types/professional";
const base = (clinic: string) => `/clinics/${clinic}/professionals`;
export const professionalsApi = {
  list: (clinic: string, signal?: AbortSignal) =>
    httpClient.get<Professional[]>(base(clinic), { signal }),
  detail: (clinic: string, id: string, signal?: AbortSignal) =>
    httpClient.get<Professional>(`${base(clinic)}/${id}`, { signal }),
  create: (clinic: string, payload: CreateProfessionalPayload) =>
    httpClient.post<Professional>(base(clinic), payload),
  update: (clinic: string, id: string, payload: Partial<ProfessionalFields>) =>
    httpClient.patch<Professional>(`${base(clinic)}/${id}`, payload),
  members: (clinic: string, signal?: AbortSignal) =>
    httpClient.get<ProfessionalMembership[]>(`/clinics/${clinic}/users`, {
      signal,
    }),
};
