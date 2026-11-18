import { useAuthorizedMutation } from '../../../lib/authorized-query'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../hooks/use-auth'
import { quarantineAuthorization } from '../../../lib/authorization-store'
import type { ClinicRole } from '../../auth/types/auth'
import type { ClinicTeamMember } from '../../clinics/types/clinic'
import { clinicUsersApi } from '../api/clinic-users-api'
export function useClinicUserMutations(clinic: string) {
  const cache = useQueryClient()
  const { user, revalidateSession } = useAuth()
  const onSuccess = async (member: ClinicTeamMember) => {
    if (member.clinicId !== clinic) throw new Error('Invalid membership scope')
    if (member.userId === user?.id) {
      quarantineAuthorization()
      await revalidateSession()
    }
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['clinic-management'] }),
      cache.invalidateQueries({ queryKey: ['clinic-memberships'] }),
      cache.invalidateQueries({ queryKey: ['user-management'] }),
      cache.invalidateQueries({ queryKey: ['professionals'] }),
      cache.invalidateQueries({ queryKey: ['appointment-professionals'] }),
    ])
  }
  return {
    create: useAuthorizedMutation({
      mutationFn: ({ userId, role }: { userId: string; role: ClinicRole }) =>
        clinicUsersApi.create(clinic, userId, role),
      onSuccess,
      gcTime: 0,
    }),
    role: useAuthorizedMutation({
      mutationFn: ({ userId, role }: { userId: string; role: ClinicRole }) =>
        clinicUsersApi.role(clinic, userId, role),
      onSuccess,
      gcTime: 0,
    }),
    active: useAuthorizedMutation({
      mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
        clinicUsersApi.active(clinic, userId, active),
      onSuccess,
      gcTime: 0,
    }),
  }
}
