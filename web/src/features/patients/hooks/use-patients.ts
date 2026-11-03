import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { queryClient } from '../../../lib/query-client'
import { patientsApi } from '../api/patients-api'
import type { PatientPayload, PatientsQuery } from '../types/patient'

export const patientKeys = {
  all: (clinicId: string) => ['patients', clinicId] as const,
  lists: (clinicId: string) => [...patientKeys.all(clinicId), 'list'] as const,
  list: (clinicId: string, query: PatientsQuery) => [...patientKeys.lists(clinicId), query] as const,
  detail: (clinicId: string, patientId: string) => [...patientKeys.all(clinicId), 'detail', patientId] as const,
}

export function usePatients(clinicId: string | null, query: PatientsQuery) {
  return useQuery({
    queryKey: clinicId ? patientKeys.list(clinicId, query) : ['patients', 'disabled'],
    queryFn: () => patientsApi.list(clinicId!, query),
    enabled: Boolean(clinicId),
    placeholderData: keepPreviousData,
  })
}

export function usePatient(clinicId: string | null, patientId?: string) {
  return useQuery({
    queryKey: clinicId && patientId ? patientKeys.detail(clinicId, patientId) : ['patient', 'disabled'],
    queryFn: () => patientsApi.findById(clinicId!, patientId!),
    enabled: Boolean(clinicId && patientId),
  })
}

export function useCreatePatient(clinicId: string) {
  return useMutation({
    mutationFn: (payload: PatientPayload) => patientsApi.create(clinicId, payload),
    onSuccess: (patient) => {
      queryClient.setQueryData(patientKeys.detail(clinicId, patient.id), patient)
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists(clinicId) })
    },
  })
}

export function useUpdatePatient(clinicId: string, patientId: string) {
  return useMutation({
    mutationFn: (payload: PatientPayload) => patientsApi.update(clinicId, patientId, payload),
    onSuccess: (patient) => {
      queryClient.setQueryData(patientKeys.detail(clinicId, patientId), patient)
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists(clinicId) })
    },
  })
}

export function useUpdatePatientStatus(clinicId: string, patientId: string) {
  return useMutation({
    mutationFn: (active: boolean) => patientsApi.updateActive(clinicId, patientId, active),
    onSuccess: (patient) => {
      queryClient.setQueryData(patientKeys.detail(clinicId, patientId), patient)
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists(clinicId) })
    },
  })
}
