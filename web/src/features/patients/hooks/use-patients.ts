import { useAuthorizedQuery, useAuthorizedMutation } from '../../../lib/authorized-query'
import { queryClient } from '../../../lib/query-client'
import { patientsApi } from '../api/patients-api'
import type { PatientPayload, PatientsQuery } from '../types/patient'

export const patientKeys = {
  all: (clinicId: string) => ['patients', clinicId] as const,
  lists: (clinicId: string) => [...patientKeys.all(clinicId), 'list'] as const,
  list: (clinicId: string, query: PatientsQuery) =>
    [...patientKeys.lists(clinicId), query] as const,
  detail: (clinicId: string, patientId: string) =>
    [...patientKeys.all(clinicId), 'detail', patientId] as const,
}

export function usePatients(clinicId: string | null, query: PatientsQuery) {
  return useAuthorizedQuery({
    queryKey: clinicId ? patientKeys.list(clinicId, query) : ['patients', 'disabled'],
    queryFn: () => patientsApi.list(clinicId!, query),
    enabled: Boolean(clinicId),
  })
}

export function usePatient(clinicId: string | null, patientId?: string) {
  return useAuthorizedQuery({
    queryKey:
      clinicId && patientId
        ? patientKeys.detail(clinicId, patientId)
        : ['patient', 'disabled'],
    queryFn: () => patientsApi.findById(clinicId!, patientId!),
    enabled: Boolean(clinicId && patientId),
  })
}

export function useCreatePatient(clinicId: string) {
  return useAuthorizedMutation({
    mutationFn: (payload: PatientPayload) => patientsApi.create(clinicId, payload),
    onSuccess: (patient) => {
      void queryClient.invalidateQueries({
        queryKey: patientKeys.detail(clinicId, patient.id),
      })
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists(clinicId) })
    },
  })
}

export function useUpdatePatient(clinicId: string, patientId: string) {
  return useAuthorizedMutation({
    mutationFn: (payload: PatientPayload) =>
      patientsApi.update(clinicId, patientId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: patientKeys.detail(clinicId, patientId),
      })
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists(clinicId) })
    },
  })
}

export function useUpdatePatientStatus(clinicId: string, patientId: string) {
  return useAuthorizedMutation({
    mutationFn: (active: boolean) =>
      patientsApi.updateActive(clinicId, patientId, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: patientKeys.detail(clinicId, patientId),
      })
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists(clinicId) })
    },
  })
}
