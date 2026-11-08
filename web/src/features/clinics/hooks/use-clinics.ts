import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clinicsApi } from '../api/clinics-api'
import type {
  Clinic,
  ClinicMembership,
  CreateClinicPayload,
  UpdateClinicPayload,
} from '../types/clinic'
export const clinicKeys = {
  scope: (user: string) => ['clinic-management', user] as const,
  detail: (user: string, id: string) =>
    ['clinic-management', user, 'detail', id] as const,
}
export function useClinics(user: string) {
  return useQuery({
    queryKey: [...clinicKeys.scope(user), 'global'],
    queryFn: ({ signal }) => clinicsApi.list(signal),
    gcTime: 0,
  })
}
export function useClinicDetails(user: string, id: string) {
  return useQuery({
    queryKey: clinicKeys.detail(user, id),
    queryFn: async ({ signal }) => {
      const clinic = await clinicsApi.detail(id, signal)
      if (clinic.id !== id) throw new Error('Invalid clinic scope')
      return clinic
    },
    enabled: Boolean(id),
    gcTime: 0,
    staleTime: 0,
  })
}
export function useClinicTeam(user: string, id: string) {
  return useQuery({
    queryKey: [...clinicKeys.scope(user), 'team', id],
    queryFn: async ({ signal }) => {
      const team = await clinicsApi.team(id, signal)
      if (team.some((member) => member.clinicId !== id))
        throw new Error('Invalid team scope')
      return team
    },
    gcTime: 0,
  })
}
export function useClinicMutations(user: string) {
  const cache = useQueryClient()
  const onSuccess = async (clinic: Clinic) => {
    cache.setQueryData(clinicKeys.detail(user, clinic.id), clinic)
    cache.setQueryData<ClinicMembership[]>(['clinic-memberships', user], (old) =>
      old?.map((m) =>
        m.clinicId === clinic.id
          ? {
              ...m,
              clinic: {
                ...m.clinic,
                id: clinic.id,
                name: clinic.name,
                document: clinic.document,
                active: clinic.active,
              },
            }
          : m,
      ),
    )
    await Promise.all([
      cache.invalidateQueries({ queryKey: clinicKeys.scope(user) }),
      cache.invalidateQueries({ queryKey: ['clinic-memberships', user] }),
    ])
  }
  return {
    create: useMutation({
      mutationFn: (payload: CreateClinicPayload) => clinicsApi.create(payload),
      onSuccess,
      gcTime: 0,
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: UpdateClinicPayload }) =>
        clinicsApi.update(id, payload),
      onSuccess,
      gcTime: 0,
    }),
    active: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) =>
        clinicsApi.active(id, active),
      onSuccess,
      gcTime: 0,
    }),
  }
}
