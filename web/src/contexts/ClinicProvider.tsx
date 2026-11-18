import { useQuery } from '@tanstack/react-query'
import {
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { isApiError } from '../api/api-error'
import { clinicsApi } from '../features/clinics/api/clinics-api'
import { getAllowedMemberships } from '../features/clinics/lib/allowed-memberships'
import { useAuth } from '../hooks/use-auth'
import {
  assertAuthorization,
  getAuthorization,
  permissionSignature,
  quarantineAuthorization,
  setAuthorizationClinic,
  subscribeAuthorization,
} from '../lib/authorization-store'
import { ClinicContext, type ClinicContextValue } from './clinic-context'

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { user, revalidateSession } = useAuth()
  const authorization = useSyncExternalStore(
    subscribeAuthorization,
    getAuthorization,
    getAuthorization,
  )
  const [selection, setSelection] = useState<{ userId: string; clinicId: string } | null>(
    null,
  )
  const membershipsQuery = useQuery({
    queryKey: ['clinic-memberships', user?.id, authorization.identity],
    queryFn: async ({ signal }) => {
      const identity = getAuthorization().identity
      const data = await clinicsApi.listUserMemberships(user!.id, signal)
      assertAuthorization(identity, true)
      if (data.some((m) => m.userId !== user!.id))
        throw new Error('Invalid membership identity')
      const activeRoles = data
        .filter((m) => m.active && m.clinic?.active)
        .map((m) => ({ clinicId: m.clinicId, role: m.role }))
      const current = getAuthorization().user
      if (
        current &&
        permissionSignature(current) !==
          permissionSignature({ ...current, clinicRoles: activeRoles })
      ) {
        quarantineAuthorization()
        await revalidateSession()
        assertAuthorization(identity, true)
        const refreshed = getAuthorization().user
        if (
          refreshed &&
          permissionSignature(refreshed) !==
            permissionSignature({ ...refreshed, clinicRoles: activeRoles })
        ) {
          quarantineAuthorization() // Concurrent changes: stay blocked until explicit retry/focus/poll.
        }
      }
      return data
    },
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })
  const memberships = useMemo(
    () => (user ? getAllowedMemberships(user, membershipsQuery.data ?? []) : []),
    [user, membershipsQuery.data],
  )
  const selected = selection?.userId === user?.id ? selection?.clinicId : null
  const activeMembership = selected
    ? (memberships.find((m) => m.clinicId === selected) ?? null)
    : memberships.length === 1
      ? memberships[0]
      : null
  const activeClinicId = activeMembership?.clinicId ?? null
  useLayoutEffect(() => {
    setAuthorizationClinic(activeClinicId)
  }, [activeClinicId])

  function selectClinic(clinicId: string) {
    if (!user || !memberships.some((m) => m.clinicId === clinicId))
      throw new Error('A clínica selecionada não pertence ao usuário.')
    if (clinicId === activeClinicId) return
    if (
      !window.dispatchEvent(
        new Event('medvita:before-clinic-change', { cancelable: true }),
      )
    )
      return
    setSelection({ userId: user.id, clinicId })
    setAuthorizationClinic(clinicId, true)
  }
  const error = membershipsQuery.error
    ? isApiError(membershipsQuery.error)
      ? membershipsQuery.error.message
      : 'Não foi possível verificar as clínicas autorizadas.'
    : null
  const value: ClinicContextValue = {
    memberships,
    activeMembership,
    activeClinicId,
    activeRole: activeMembership?.role ?? null,
    isLoading: membershipsQuery.isLoading,
    error,
    selectClinic,
  }
  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}
