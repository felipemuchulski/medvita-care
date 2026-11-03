import { httpClient } from '../../../api/http-client'
import type { ClinicMembership } from '../types/clinic'

export const clinicsApi = {
  listUserMemberships(userId: string): Promise<ClinicMembership[]> {
    return httpClient.get<ClinicMembership[]>(`/users/${userId}/clinics`)
  },
}
