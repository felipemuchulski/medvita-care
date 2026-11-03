import { httpClient } from '../../../api/http-client'
import type {
  Patient,
  PatientPayload,
  PatientsQuery,
  PatientsResponse,
} from '../types/patient'

function basePath(clinicId: string): string {
  return `/clinics/${clinicId}/patients`
}

export const patientsApi = {
  list(clinicId: string, query: PatientsQuery): Promise<PatientsResponse> {
    return httpClient.get<PatientsResponse>(basePath(clinicId), {
      query: {
        page: query.page,
        limit: query.limit,
        search: query.search,
        active: query.active,
      },
    })
  },

  findById(clinicId: string, patientId: string): Promise<Patient> {
    return httpClient.get<Patient>(`${basePath(clinicId)}/${patientId}`)
  },

  create(clinicId: string, payload: PatientPayload): Promise<Patient> {
    return httpClient.post<Patient, PatientPayload>(basePath(clinicId), payload)
  },

  update(
    clinicId: string,
    patientId: string,
    payload: PatientPayload,
  ): Promise<Patient> {
    return httpClient.patch<Patient, PatientPayload>(
      `${basePath(clinicId)}/${patientId}`,
      payload,
    )
  },

  updateActive(
    clinicId: string,
    patientId: string,
    active: boolean,
  ): Promise<Patient> {
    return httpClient.patch<Patient, { active: boolean }>(
      `${basePath(clinicId)}/${patientId}/active`,
      { active },
    )
  },
}
