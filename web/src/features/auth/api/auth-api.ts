import { httpClient } from '../../../api/http-client'
import type {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  MessageResponse,
} from '../types/auth'

const sessionOptions = {
  sessionOperation: true,
  credentials: 'include' as const,
  headers: { 'X-Medvita-Session': '1' },
}

export const authApi = {
  login(payload: LoginRequest): Promise<AuthResponse> {
    return httpClient.post<AuthResponse, LoginRequest>('/auth/login', payload, {
      ...sessionOptions,
      authenticated: false,
    })
  },

  refresh(): Promise<AuthResponse> {
    return httpClient.post<AuthResponse>('/auth/refresh', undefined, {
      ...sessionOptions,
      authenticated: false,
    })
  },

  logout(): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>('/auth/logout', undefined, {
      ...sessionOptions,
      retryAfterRefresh: true,
    })
  },

  changePassword(payload: ChangePasswordRequest): Promise<MessageResponse> {
    return httpClient.patch<MessageResponse, ChangePasswordRequest>(
      '/auth/change-password',
      payload,
      sessionOptions,
    )
  },
}
