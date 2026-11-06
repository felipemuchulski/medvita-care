import { httpClient } from '../../../api/http-client'
import type { Appointment, AppointmentPayload, AppointmentQuery, AppointmentResponse, Professional } from '../types/appointment'
const base = (clinic: string) => `/clinics/${clinic}/appointments`
export const appointmentsApi = {
  list: (clinic: string, query: AppointmentQuery, signal?: AbortSignal) => httpClient.get<AppointmentResponse>(base(clinic), { query: { ...query }, signal }),
  detail: (clinic: string, id: string, signal?: AbortSignal) => httpClient.get<Appointment>(`${base(clinic)}/${id}`, { signal }),
  create: (clinic: string, payload: AppointmentPayload) => httpClient.post<Appointment>(base(clinic), payload),
  reschedule: (clinic: string, id: string, payload: Pick<AppointmentPayload, 'scheduledAt' | 'durationMinutes'>) => httpClient.patch<Appointment>(`${base(clinic)}/${id}/reschedule`, payload),
  cancel: (clinic: string, id: string, reason: string) => httpClient.patch<Appointment>(`${base(clinic)}/${id}/cancel`, { reason }),
  professionals: (clinic: string, signal?: AbortSignal) => httpClient.get<Professional[]>(`/clinics/${clinic}/professionals`, { signal }),
}
