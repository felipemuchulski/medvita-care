import { useAuthorizedQuery, useAuthorizedMutation } from '../../../lib/authorized-query'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../hooks/use-auth'
import { useClinic } from '../../../hooks/use-clinic'
import { professionalsApi } from '../api/professionals-api'
import type { CreateProfessionalPayload, ProfessionalFields } from '../types/professional'
export const professionalKeys = {
  all: ['professionals'] as const,
  clinic: (clinic: string) => ['professionals', clinic] as const,
}
function useScope() {
  const { user } = useAuth()
  const { activeRole } = useClinic()
  return [user?.id, activeRole, user?.isSystemAdmin] as const
}
export function useProfessionals(clinic: string) {
  const scope = useScope()
  return useAuthorizedQuery({
    queryKey: [...professionalKeys.clinic(clinic), 'list', ...scope],
    queryFn: ({ signal }) => professionalsApi.list(clinic, signal),
    enabled: Boolean(clinic && scope[0]),
  })
}
export function useProfessional(clinic: string, id: string) {
  const scope = useScope()
  return useAuthorizedQuery({
    queryKey: [...professionalKeys.clinic(clinic), 'detail', id, ...scope],
    queryFn: ({ signal }) => professionalsApi.detail(clinic, id, signal),
    enabled: Boolean(clinic && id && scope[0]),
  })
}
export function useEligibleProfessionalUsers(clinic: string, enabled: boolean) {
  const scope = useScope()
  return useAuthorizedQuery({
    queryKey: [...professionalKeys.clinic(clinic), 'members', ...scope],
    queryFn: ({ signal }) => professionalsApi.members(clinic, signal),
    enabled: enabled && Boolean(clinic && scope[0]),
  })
}
export function useProfessionalMutations(clinic: string) {
  const cache = useQueryClient()
  const onSuccess = async () => {
    // Profiles are global: changes can affect every clinic linked to the same user.
    await Promise.all([
      cache.invalidateQueries({ queryKey: professionalKeys.all }),
      cache.invalidateQueries({ queryKey: ['appointments'] }),
      cache.invalidateQueries({ queryKey: ['appointment-professionals'] }),
    ])
  }
  const create = useAuthorizedMutation({
    mutationFn: (payload: CreateProfessionalPayload) =>
      professionalsApi.create(clinic, payload),
    onSuccess,
  })
  const update = useAuthorizedMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProfessionalFields> }) =>
      professionalsApi.update(clinic, id, payload),
    onSuccess,
  })
  return { create, update }
}
