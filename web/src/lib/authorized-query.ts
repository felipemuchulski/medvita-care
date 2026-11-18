import { createContext, useContext, useState, useSyncExternalStore } from 'react'
import {
  useQuery,
  useMutation,
  type QueryFunction,
  type QueryKey,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import {
  assertAuthorization,
  getAuthorization,
  subscribeAuthorization,
} from './authorization-store'

export const AuthorizationView = createContext<ReturnType<
  typeof getAuthorization
> | null>(null)
export function useAuthorizationView() {
  const live = useSyncExternalStore(
    subscribeAuthorization,
    getAuthorization,
    getAuthorization,
  )
  const frozen = useContext(AuthorizationView)
  return { view: frozen ?? live, live }
}
export function useAuthorizationCheck() {
  const { view } = useAuthorizationView()
  return () => assertAuthorization(view.revision)
}
export function useAuthorizedQuery<T>(options: UseQueryOptions<T, Error, T, QueryKey>) {
  const { view, live } = useAuthorizationView()
  const fn = options.queryFn as QueryFunction<T, QueryKey>
  const result = useQuery<T, Error, T, QueryKey>({
    ...options,
    queryKey: [
      ...options.queryKey,
      { authorization: [view.user?.id, view.clinicId, view.identity, view.revision] },
    ],
    enabled:
      Boolean(view.user) &&
      !live.blocked &&
      live.revision === view.revision &&
      options.enabled !== false,
    // Previous data is never copied across an authorization/resource boundary.
    placeholderData: undefined,
    queryFn: async (context) => {
      assertAuthorization(view.revision)
      const data = await fn(context)
      assertAuthorization(view.revision)
      return data
    },
  })
  // A paused boundary is hidden/inert. Keep its previous render in memory so
  // query removal cannot unmount an unsaved form before explicit acknowledgement.
  const [previous, setPrevious] = useState(result)
  const frozen = view.revision !== live.revision
  if (
    !frozen &&
    (previous.data !== result.data ||
      previous.error !== result.error ||
      previous.status !== result.status ||
      previous.fetchStatus !== result.fetchStatus)
  )
    setPrevious(result)
  return frozen ? previous : result
}
export function useAuthorizedMutation<T, V = void>(
  options: UseMutationOptions<T, Error, V>,
) {
  const { view } = useAuthorizationView()
  return useMutation<T, Error, V>({
    ...options,
    retry: false,
    mutationKey: [
      ...(options.mutationKey ?? []),
      { authorization: [view.user?.id, view.clinicId, view.identity, view.revision] },
    ],
    mutationFn: async (variables, context) => {
      assertAuthorization(view.revision)
      const data = await options.mutationFn!(variables, context)
      assertAuthorization(view.revision)
      return data
    },
    onSuccess: async (...args) => {
      assertAuthorization(view.revision)
      await options.onSuccess?.(...args)
      assertAuthorization(view.revision)
    },
  })
}
