import { useAuthorizedQuery } from '../../../lib/authorized-query'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../hooks/use-auth'
import { quarantineAuthorization } from '../../../lib/authorization-store'
import { clinicsApi } from '../../clinics/api/clinics-api'
import { usersApi } from '../api/users-api'
import type { ManagedUser, UserQuery } from '../types/user'
export const userKeys = { scope: (actor: string) => ['user-management', actor] as const }
export function useUsers(actor: string, query: UserQuery, enabled = true) {
  return useAuthorizedQuery({
    queryKey: [...userKeys.scope(actor), 'list', query],
    queryFn: ({ signal }) => usersApi.list(query, signal),
    gcTime: 0,
    enabled,
  })
}
export function useManagedUser(actor: string, id: string) {
  return useAuthorizedQuery({
    queryKey: [...userKeys.scope(actor), 'detail', id],
    queryFn: async ({ signal }) => {
      const user = await usersApi.detail(id, signal)
      if (user.id !== id) throw new Error('Invalid user scope')
      return user
    },
    gcTime: 0,
    staleTime: 0,
  })
}
export function useUserMemberships(actor: string, id: string) {
  return useAuthorizedQuery({
    queryKey: [...userKeys.scope(actor), 'memberships', id],
    queryFn: async () => {
      const data = await clinicsApi.listUserMemberships(id)
      if (data.some((m) => m.userId !== id)) throw new Error('Invalid membership scope')
      return data
    },
    gcTime: 0,
    staleTime: 0,
  })
}
export function useUserCommitted() {
  const cache = useQueryClient()
  const { user, revalidateSession } = useAuth()
  return async (record: ManagedUser) => {
    if (!user) return
    if (record.id === user.id) {
      if (record.isSystemAdmin !== user.isSystemAdmin || !record.active)
        quarantineAuthorization()
      if (!(await revalidateSession())) return
    }
    await Promise.all([
      cache.invalidateQueries({ queryKey: userKeys.scope(user.id) }),
      cache.invalidateQueries({ queryKey: ['clinic-management'] }),
      cache.invalidateQueries({ queryKey: ['professionals'] }),
      cache.invalidateQueries({ queryKey: ['clinic-memberships'] }),
    ])
  }
}
