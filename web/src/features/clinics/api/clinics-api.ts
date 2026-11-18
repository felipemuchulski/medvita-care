import { httpClient } from '../../../api/http-client'
import type {
  Clinic,
  ClinicMembership,
  ClinicTeamMember,
  CreateClinicPayload,
  UpdateClinicPayload,
} from '../types/clinic'

export const clinicsApi = {
  list: (signal?: AbortSignal) => httpClient.get<Clinic[]>('/clinics', { signal }),
  detail: (id: string, signal?: AbortSignal) =>
    httpClient.get<Clinic>(`/clinics/${id}`, { signal }),
  create: (payload: CreateClinicPayload) => httpClient.post<Clinic>('/clinics', payload),
  update: (id: string, payload: UpdateClinicPayload) =>
    httpClient.patch<Clinic>(`/clinics/${id}`, payload),
  active: (id: string, active: boolean) =>
    httpClient.patch<Clinic>(`/clinics/${id}/active`, { active }),
  team: (id: string, signal?: AbortSignal) =>
    httpClient.get<ClinicTeamMember[]>(`/clinics/${id}/users`, { signal }),
  listUserMemberships(userId: string, signal?: AbortSignal): Promise<ClinicMembership[]> {
    return httpClient.get<ClinicMembership[]>(`/users/${userId}/clinics`, {
      signal,
      identityOnly: true,
    })
  },
}
