import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { isApiError } from '../api/api-error'
import { clinicsApi } from '../features/clinics/api/clinics-api'
import { getAllowedMemberships } from '../features/clinics/lib/allowed-memberships'
import { useAuth } from '../hooks/use-auth'
import { queryClient } from '../lib/query-client'
import { ClinicContext, type ClinicContextValue } from './clinic-context'

interface ClinicSelection {
  userId: string
  clinicId: string
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [selection, setSelection] = useState<ClinicSelection | null>(null)
  const membershipsQuery = useQuery({
    queryKey: ['clinic-memberships', user?.id],
    queryFn: () => clinicsApi.listUserMemberships(user!.id),
    enabled: Boolean(user),
  })

  const memberships = useMemo(
    () =>
      user
        ? getAllowedMemberships(user, membershipsQuery.data ?? [])
        : [],
    [membershipsQuery.data, user],
  )

  const selectedClinicId =
    selection && selection.userId === user?.id ? selection.clinicId : null
  const activeMembership =
    memberships.find((membership) => membership.clinicId === selectedClinicId) ??
    (memberships.length === 1 ? memberships[0] : null)

  function selectClinic(clinicId: string): void {
    if (!user || !memberships.some((item) => item.clinicId === clinicId)) {
      throw new Error('A clínica selecionada não pertence ao usuário.')
    }

    if (clinicId === activeMembership?.clinicId) return
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'clinic-memberships',
    })
    setSelection({ userId: user.id, clinicId })
  }

  const error = membershipsQuery.error
    ? isApiError(membershipsQuery.error)
      ? membershipsQuery.error.message
      : 'Não foi possível carregar as clínicas autorizadas.'
    : null

  const value: ClinicContextValue = {
    memberships,
    activeMembership,
    activeClinicId: activeMembership?.clinicId ?? null,
    activeRole: activeMembership?.role ?? null,
    isLoading: membershipsQuery.isLoading,
    error,
    selectClinic,
  }

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}
