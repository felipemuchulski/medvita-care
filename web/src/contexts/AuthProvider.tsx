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
  const sessionRef = useRef<AuthResponse | null>(null)
  const refreshRef = useRef<() => Promise<string | null>>(async () => null)
  const expireRef = useRef<() => void>(() => undefined)

  const clearSession = useCallback(() => {
    sessionRef.current = null
    setSession(null)
    queryClient.clear()
  }, [])

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const refreshToken = sessionRef.current?.refreshToken
    if (!refreshToken) return null

    try {
      const refreshedSession = await authApi.refresh(refreshToken)
      sessionRef.current = refreshedSession
      setSession(refreshedSession)
      return refreshedSession.accessToken
    } catch {
      clearSession()
      return null
    }
  }, [clearSession])

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
    const authenticatedSession = await authApi.login(payload)
    sessionRef.current = authenticatedSession
    setSession(authenticatedSession)
  }, [])

  const logout = useCallback(async () => {
    try {
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
      status: session ? 'authenticated' : 'unauthenticated',
      user: session?.user ?? null,
      login,
      logout,
      changePassword,
    }),
    [changePassword, login, logout, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
