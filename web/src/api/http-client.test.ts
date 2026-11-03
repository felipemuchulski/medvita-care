import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api-error'
import { HttpClient } from './http-client'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HttpClient', () => {
  it('envia query, JSON e access token sem expor detalhes extras', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: 'patient-1' }))
    const client = new HttpClient({
      baseUrl: 'https://api.example.test/',
      fetcher,
    })
    client.configureAuth({ getAccessToken: () => 'access-token' })

    const result = await client.post<{ id: string }, { name: string }>(
      '/patients',
      { name: 'Maria' },
      { query: { page: 1, active: true, ignored: undefined } },
    )

    expect(result).toEqual({ id: 'patient-1' })
    expect(fetcher).toHaveBeenCalledOnce()

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(url).toBe(
      'https://api.example.test/patients?page=1&active=true',
    )
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'Maria' }))
    expect(headers.get('Authorization')).toBe('Bearer access-token')
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('normaliza mensagens de validação retornadas pela API', async () => {
    const client = new HttpClient({
      baseUrl: '/api',
      fetcher: vi.fn().mockResolvedValue(
        jsonResponse(
          { message: ['email deve ser válido', 'senha é obrigatória'] },
          { status: 400 },
        ),
      ),
    })

    await expect(
      client.post('/auth/login', {}, { authenticated: false }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      messages: ['email deve ser válido', 'senha é obrigatória'],
    })
  })

  it('não repassa mensagens internas de respostas 5xx', async () => {
    const client = new HttpClient({
      baseUrl: '/api',
      fetcher: vi.fn().mockResolvedValue(
        jsonResponse(
          { message: 'QueryFailedError: password=secret' },
          { status: 500 },
        ),
      ),
    })

    const error = await client.get('/patients').catch((value) => value)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500, code: 'SERVER_ERROR' })
    expect((error as ApiError).message).not.toContain('QueryFailedError')
    expect((error as ApiError).message).not.toContain('secret')
  })

  it('normaliza falhas de conexão', async () => {
    const client = new HttpClient({
      baseUrl: '/api',
      fetcher: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    })

    await expect(client.get('/patients')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('faz refresh single-flight e repete cada requisição somente uma vez', async () => {
    let accessToken = 'expired-token'
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      const token = new Headers(init?.headers).get('Authorization')
      return Promise.resolve(
        token === 'Bearer valid-token'
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: 'Não autorizado' }, { status: 401 }),
      )
    })
    const refreshAccessToken = vi.fn(async () => {
      await Promise.resolve()
      accessToken = 'valid-token'
      return accessToken
    })
    const client = new HttpClient({ baseUrl: '/api', fetcher })
    client.configureAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken,
    })

    const results = await Promise.all([
      client.get<{ ok: boolean }>('/patients'),
      client.get<{ ok: boolean }>('/appointments'),
    ])

    expect(results).toEqual([{ ok: true }, { ok: true }])
    expect(refreshAccessToken).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
})
