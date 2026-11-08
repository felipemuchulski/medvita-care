import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { httpClient } from '../api/http-client'
import { authApi } from '../features/auth/api/auth-api'
import type {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
} from '../features/auth/types/auth'
import { queryClient } from '../lib/query-client'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(null)
  const [restoring, setRestoring] = useState(true)
  const generation = useRef(0)
  const pendingRefresh = useRef<Promise<string | null> | null>(null)
  const bootstrap = useRef<Promise<string | null> | null>(null)
  const sessionRef = useRef<AuthResponse | null>(null)
  const refreshRef = useRef<() => Promise<string | null>>(async () => null)
  const expireRef = useRef<() => void>(() => undefined)

  const clearSession = useCallback(() => {
    generation.current += 1
    sessionRef.current = null
    setSession(null)
    queryClient.clear()
  }, [])

  const refreshSession = useCallback((): Promise<string | null> => {
    if (pendingRefresh.current) return pendingRefresh.current
    const currentGeneration = generation.current
    pendingRefresh.current = (async () => {
      try {
        const refreshedSession = await authApi.refresh()
        if (generation.current !== currentGeneration) return null
        sessionRef.current = refreshedSession
        setSession(refreshedSession)
        return refreshedSession.accessToken
      } catch {
        if (generation.current === currentGeneration) clearSession()
        return null
      } finally {
        pendingRefresh.current = null
      }
    })()
    return pendingRefresh.current
  }, [clearSession])

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
    httpClient.configureAuth({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      refreshAccessToken: () => refreshRef.current(),
      onSessionExpired: () => expireRef.current(),
    })

    return () => httpClient.configureAuth(undefined)
  }, [])

  const login = useCallback(async (payload: LoginRequest) => {
    generation.current += 1
    await pendingRefresh.current
    const authenticatedSession = await authApi.login(payload)
    sessionRef.current = authenticatedSession
    setSession(authenticatedSession)
  }, [])

  const logout = useCallback(async () => {
    if (!window.dispatchEvent(new Event('medvita:before-logout', { cancelable: true })))
      return
    try {
      generation.current += 1
      await pendingRefresh.current
      if (sessionRef.current) await authApi.logout()
    } catch {
      // A limpeza local não pode depender da disponibilidade do servidor.
    } finally {
      clearSession()
    }
  }, [clearSession])

  const changePassword = useCallback(
    async (payload: ChangePasswordRequest) => {
      await authApi.changePassword(payload)
      clearSession()
    },
    [clearSession],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status: restoring ? 'loading' : session ? 'authenticated' : 'unauthenticated',
      user: session?.user ?? null,
      login,
      logout,
      changePassword,
    }),
    [changePassword, login, logout, restoring, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
