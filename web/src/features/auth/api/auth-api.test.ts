import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '../../../api/http-client'
import { authApi } from './auth-api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('authApi', () => {
  it('usa as rotas públicas para login e refresh', async () => {
    const post = vi
      .spyOn(httpClient, 'post')
      .mockResolvedValueOnce({ accessToken: 'access' })
      .mockResolvedValueOnce({ accessToken: 'renewed' })

    await authApi.login({ email: 'user@example.com', password: 'password' })
    await authApi.refresh('refresh-token')

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/auth/login',
      { email: 'user@example.com', password: 'password' },
      { authenticated: false },
    )
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/auth/refresh',
      { refreshToken: 'refresh-token' },
      { authenticated: false },
    )
  })

  it('mantém logout autenticado', async () => {
    const post = vi
      .spyOn(httpClient, 'post')
      .mockResolvedValue({ message: 'Logout realizado com sucesso.' })

    await authApi.logout()

    expect(post).toHaveBeenCalledWith('/auth/logout')
  })
})
