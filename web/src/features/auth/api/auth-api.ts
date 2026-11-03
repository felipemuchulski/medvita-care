import { httpClient } from '../../../api/http-client'
import type {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  MessageResponse,
} from '../types/auth'

export const authApi = {
  login(payload: LoginRequest): Promise<AuthResponse> {
    return httpClient.post<AuthResponse, LoginRequest>('/auth/login', payload, {
      authenticated: false,
    })
  },

  refresh(refreshToken: string): Promise<AuthResponse> {
    return httpClient.post<AuthResponse, { refreshToken: string }>(
      '/auth/refresh',
      { refreshToken },
      { authenticated: false },
    )
  },

  logout(): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>('/auth/logout')
  },

  changePassword(payload: ChangePasswordRequest): Promise<MessageResponse> {
    return httpClient.patch<MessageResponse, ChangePasswordRequest>(
      '/auth/change-password',
      payload,
    )
  },
}
