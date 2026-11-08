import { httpClient } from '../../../api/http-client'
import type {
  ClinicalPayload,
  Encounter,
  EncounterQuery,
  EncounterResponse,
} from '../types/encounter'
const base = (clinic: string) => `/clinics/${clinic}/encounters`
export const encountersApi = {
  list: (clinic: string, query: EncounterQuery, signal?: AbortSignal) =>
    httpClient.get<EncounterResponse>(base(clinic), { query: { ...query }, signal }),
  history: (
    clinic: string,
    patient: string,
    query: EncounterQuery,
    signal?: AbortSignal,
  ) =>
    httpClient.get<EncounterResponse>(
      `/clinics/${clinic}/patients/${patient}/encounters`,
      { query: { ...query }, signal },
    ),
  detail: (clinic: string, id: string, signal?: AbortSignal) =>
    httpClient.get<Encounter>(`${base(clinic)}/${id}`, { signal }),
  start: (clinic: string, appointmentId: string) =>
    httpClient.post<Encounter>(base(clinic), { appointmentId }),
  save: (clinic: string, id: string, payload: Partial<ClinicalPayload>) =>
    httpClient.patch<Encounter>(`${base(clinic)}/${id}`, payload),
  complete: (clinic: string, id: string, payload: ClinicalPayload) =>
    httpClient.patch<Encounter>(`${base(clinic)}/${id}/complete`, payload),
  cancel: (clinic: string, id: string, reason: string) =>
    httpClient.patch<Encounter>(`${base(clinic)}/${id}/cancel`, { reason }),
}
