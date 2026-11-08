import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })

  const memberships = useMemo(
    () =>
      user && !membershipsQuery.isError
        ? getAllowedMemberships(user, membershipsQuery.data ?? [])
        : [],
    [membershipsQuery.data, membershipsQuery.isError, user],
  )

  const selectedClinicId =
    selection && selection.userId === user?.id ? selection.clinicId : null
  const activeMembership = selectedClinicId
    ? (memberships.find((membership) => membership.clinicId === selectedClinicId) ?? null)
    : memberships.length === 1
      ? memberships[0]
      : null
  const previousClinic = useRef<string | null>(null)
  const activeId = activeMembership?.clinicId ?? null
  useEffect(() => {
    const previous = previousClinic.current
    previousClinic.current = activeId
    if (previous && previous !== activeId) {
      const predicate = (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] !== 'clinic-memberships' &&
        query.queryKey[0] !== 'clinic-management' &&
        query.queryKey[0] !== 'user-management' &&
        query.queryKey.includes(previous)
      void queryClient.cancelQueries({ predicate })
      queryClient.removeQueries({ predicate })
    }
  }, [activeId])

  function selectClinic(clinicId: string): void {
    if (!user || !memberships.some((item) => item.clinicId === clinicId)) {
      throw new Error('A clínica selecionada não pertence ao usuário.')
    }

    if (clinicId === activeMembership?.clinicId) return
    if (
      !window.dispatchEvent(
        new Event('medvita:before-clinic-change', { cancelable: true }),
      )
    )
      return
    queryClient.removeQueries({
      predicate: (query) =>
        query.queryKey[0] !== 'clinic-memberships' &&
        query.queryKey[0] !== 'clinic-management' &&
        query.queryKey[0] !== 'user-management',
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
