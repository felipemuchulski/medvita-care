import { httpClient } from '../../../api/http-client'
import type { ClinicRole } from '../../auth/types/auth'
import type { ClinicTeamMember } from '../../clinics/types/clinic'
const base = (clinic: string) => `/clinics/${clinic}/users`
export const clinicUsersApi = {
  create: (clinic: string, userId: string, role: ClinicRole) =>
    httpClient.post<ClinicTeamMember>(base(clinic), { userId, role }),
  role: (clinic: string, userId: string, role: ClinicRole) =>
    httpClient.patch<ClinicTeamMember>(`${base(clinic)}/${userId}/role`, { role }),
  active: (clinic: string, userId: string, active: boolean) =>
    httpClient.patch<ClinicTeamMember>(`${base(clinic)}/${userId}/active`, { active }),
}
