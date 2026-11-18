import { useAuthorizedQuery, useAuthorizedMutation } from '../../../lib/authorized-query'
import { useQueryClient } from '@tanstack/react-query'
import { encountersApi } from '../api/encounters-api'
import type {
  ClinicalPayload,
  Encounter,
  EncounterQuery,
  EncounterResponse,
} from '../types/encounter'
export const encounterKeys = {
  all: ['encounters'] as const,
  scope: (clinic: string, user: string) => ['encounters', clinic, user] as const,
}
function assertClinicalClinic(record: Encounter, clinic: string) {
  if (record.clinicId !== clinic) throw new Error('Invalid clinical context')
  return record
}
export function assertClinicalList(
  data: EncounterResponse,
  clinic: string,
  patient?: string,
  user?: string,
) {
  data.data.forEach((r) => {
    assertClinicalClinic(r, clinic)
    if ((patient && r.patientId !== patient) || (user && r.professional.userId !== user))
      throw new Error('Invalid clinical scope')
  })
  return data
}
export function useEncounters(
  clinic: string,
  user: string,
  query: EncounterQuery,
  patient?: string,
  enabled = true,
) {
  return useAuthorizedQuery({
    queryKey: [
      ...encounterKeys.scope(clinic, user),
      patient ? 'history' : 'list',
      patient,
      query,
    ],
    queryFn: async ({ signal }) =>
      assertClinicalList(
        await (patient
          ? encountersApi.history(clinic, patient, query, signal)
          : encountersApi.list(clinic, query, signal)),
        clinic,
        patient,
        patient ? undefined : user,
      ),
    enabled: Boolean(clinic && user) && enabled,
    gcTime: 0,
    staleTime: 0,
  })
}
export function useEncounter(clinic: string, user: string, id: string) {
  return useAuthorizedQuery({
    queryKey: [...encounterKeys.scope(clinic, user), 'detail', id],
    queryFn: async ({ signal }) => {
      const record = assertClinicalClinic(
        await encountersApi.detail(clinic, id, signal),
        clinic,
      )
      if (record.professional.userId !== user) throw new Error('Invalid clinical scope')
      return record
    },
    enabled: Boolean(clinic && user && id),
    gcTime: 0,
    staleTime: 0,
  })
}
export function useEncounterMutations(clinic: string, user: string) {
  const cache = useQueryClient()
  const onSuccess = async (record: Encounter) => {
    assertClinicalClinic(record, clinic)
    if (record.professional.userId !== user) throw new Error('Invalid clinical scope')
    await Promise.all([
      cache.invalidateQueries({ queryKey: encounterKeys.scope(clinic, user) }),
      cache.invalidateQueries({ queryKey: ['appointments', clinic] }),
    ])
  }
  return {
    start: useAuthorizedMutation({
      mutationFn: (appointmentId: string) => encountersApi.start(clinic, appointmentId),
      onSuccess,
      gcTime: 0,
    }),
    save: useAuthorizedMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<ClinicalPayload> }) =>
        encountersApi.save(clinic, id, payload),
      onSuccess,
      gcTime: 0,
    }),
    complete: useAuthorizedMutation({
      mutationFn: ({ id, payload }: { id: string; payload: ClinicalPayload }) =>
        encountersApi.complete(clinic, id, payload),
      onSuccess,
      gcTime: 0,
    }),
    cancel: useAuthorizedMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        encountersApi.cancel(clinic, id, reason),
      onSuccess,
      gcTime: 0,
    }),
  }
}
