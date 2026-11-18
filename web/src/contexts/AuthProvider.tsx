import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { httpClient } from '../api/http-client'
import { authApi } from '../features/auth/api/auth-api'
import type {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
} from '../features/auth/types/auth'
import { queryClient } from '../lib/query-client'
import { setAuthorizationUser, quarantineAuthorization } from '../lib/authorization-store'
import { ApiError, isApiError } from '../api/api-error'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(null)
  const [restoring, setRestoring] = useState(true)
  const generation = useRef(0)
  const mounted = useRef(true)
  const pendingRefresh = useRef<Promise<string | null> | null>(null)
  const bootstrap = useRef<Promise<string | null> | null>(null)
  const sessionRef = useRef<AuthResponse | null>(null)
  const refreshRef = useRef<(permissionCheck?: boolean) => Promise<string | null>>(
    async () => null,
  )
  const expireRef = useRef<() => void>(() => undefined)

  const clearSession = useCallback(() => {
    generation.current += 1
    sessionRef.current = null
    setSession(null)
    setAuthorizationUser(null)
    void queryClient.cancelQueries()
    queryClient.clear()
  }, [])

  const refreshSession = useCallback(
    (permissionCheck = false): Promise<string | null> => {
      if (pendingRefresh.current) return pendingRefresh.current
      const currentGeneration = generation.current
      pendingRefresh.current = (async () => {
        try {
          const refreshedSession = await authApi.refresh()
          if (!mounted.current || generation.current !== currentGeneration) return null
          sessionRef.current = refreshedSession
          setAuthorizationUser(refreshedSession.user)
          setSession(refreshedSession)
          return refreshedSession.accessToken
        } catch (error) {
          if (mounted.current && generation.current === currentGeneration) {
            if (!permissionCheck || (isApiError(error) && error.status === 401))
              clearSession()
            else quarantineAuthorization()
          }
          return null
        } finally {
          pendingRefresh.current = null
        }
      })()
      return pendingRefresh.current
    },
    [clearSession],
  )

  useEffect(() => {
    let active = true
    // Reuse the request when StrictMode runs the effect twice.
    bootstrap.current ??= refreshSession()
    void bootstrap.current.finally(() => {
      if (active) setRestoring(false)
    })
    return () => {
      active = false
    }
  }, [refreshSession])

  useEffect(() => {
    refreshRef.current = refreshSession
    expireRef.current = clearSession
  }, [clearSession, refreshSession])

  useEffect(() => {
    mounted.current = true
    httpClient.configureAuth({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      refreshAccessToken: () => refreshRef.current(),
      onSessionExpired: () => expireRef.current(),
      onForbidden: () => {
        quarantineAuthorization()
        void refreshRef.current(true)
      },
    })

    return () => {
      mounted.current = false
      httpClient.configureAuth(undefined)
    }
  }, [])

  const login = useCallback(
    async (payload: LoginRequest) => {
      clearSession()
      const currentGeneration = generation.current
      await pendingRefresh.current
      const authenticatedSession = await authApi.login(payload)
      if (!mounted.current || generation.current !== currentGeneration)
        throw ApiError.aborted(new Error('Login superseded'))
      sessionRef.current = authenticatedSession
      setAuthorizationUser(authenticatedSession.user, true)
      setSession(authenticatedSession)
    },
    [clearSession],
  )

  const logout = useCallback(async () => {
    if (!window.dispatchEvent(new Event('medvita:before-logout', { cancelable: true })))
      return
    const logoutGeneration = ++generation.current
    try {
      quarantineAuthorization()
      await pendingRefresh.current
      if (generation.current !== logoutGeneration) return
      if (sessionRef.current) await authApi.logout()
    } catch {
      // A limpeza local não pode depender da disponibilidade do servidor.
    } finally {
      if (generation.current === logoutGeneration) clearSession()
    }
  }, [clearSession])

  const changePassword = useCallback(
    async (payload: ChangePasswordRequest) => {
      const currentGeneration = generation.current
      await authApi.changePassword(payload)
      if (generation.current !== currentGeneration)
        throw ApiError.aborted(new Error('Session changed'))
      clearSession()
    },
    [clearSession],
  )

  const revalidateSession = useCallback(
    async () => Boolean(await refreshSession(true)),
    [refreshSession],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status: restoring ? 'loading' : session ? 'authenticated' : 'unauthenticated',
      user: session?.user ?? null,
      login,
      logout,
      changePassword,
      revalidateSession,
    }),
    [changePassword, login, logout, restoring, session, revalidateSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
