import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '../api/api-error'
import { getAuthorization, subscribeAuthorization } from './authorization-store'

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  if (!isApiError(error)) return false

  return error.code === 'NETWORK_ERROR' || error.status >= 500
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

let previous = getAuthorization()
subscribeAuthorization(() => {
  const current = getAuthorization()
  if (current.revision === previous.revision) return
  const identityChanged = current.identity !== previous.identity
  previous = current
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      identityChanged || query.queryKey[0] !== 'clinic-memberships',
  }
  void queryClient.cancelQueries(filters)
  queryClient.removeQueries(filters)
  queryClient.getMutationCache().clear()
})
