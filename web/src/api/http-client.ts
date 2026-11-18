import { ApiError } from './api-error'
import {
  announceAuthorizationNotice,
  assertAuthorization,
  authorizationSignal,
  getAuthorization,
} from '../lib/authorization-store'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type QueryPrimitive = string | number | boolean
type QueryValue = QueryPrimitive | null | undefined | readonly QueryPrimitive[]

export type QueryParams = Record<string, QueryValue>

export interface RequestOptions<TBody = unknown> extends Omit<
  RequestInit,
  'body' | 'headers' | 'method'
> {
  body?: TBody
  headers?: HeadersInit
  query?: QueryParams
  authenticated?: boolean
  sessionOperation?: boolean
  identityOnly?: boolean
  retryAfterRefresh?: boolean
}

export interface AuthHandlers {
  getAccessToken: () => string | null
  refreshAccessToken?: () => Promise<string | null>
  onSessionExpired?: () => void
  onForbidden?: () => void
}

export interface HttpClientOptions {
  baseUrl: string
  fetcher?: typeof fetch
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '')
  return normalized || '/api'
}

function appendQuery(url: string, query?: QueryParams): string {
  if (!query) return url

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue

    const values = Array.isArray(value) ? value : [value]
    for (const item of values) params.append(key, String(item))
  }

  const queryString = params.toString()
  if (!queryString) return url
  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function contextSignal(requestSignal?: AbortSignal | null) {
  const context = authorizationSignal()
  if (!requestSignal) return { signal: context, release: () => undefined }
  const controller = new AbortController()
  const abort = () => controller.abort()
  context.addEventListener('abort', abort, { once: true })
  requestSignal.addEventListener('abort', abort, { once: true })
  if (context.aborted || requestSignal.aborted) abort()
  return {
    signal: controller.signal,
    release: () => {
      context.removeEventListener('abort', abort)
      requestSignal.removeEventListener('abort', abort)
    },
  }
}

function toRequestInit<TBody>(options: RequestOptions<TBody>): RequestInit {
  const init = { ...options } as Record<string, unknown>
  delete init.body
  delete init.query
  delete init.authenticated
  delete init.sessionOperation
  delete init.identityOnly
  delete init.retryAfterRefresh
  return init as RequestInit
}

export class HttpClient {
  private readonly baseUrl: string
  private readonly fetcher: typeof fetch
  private authHandlers?: AuthHandlers
  private refreshPromise: Promise<string | null> | null = null

  constructor(options: HttpClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.fetcher = options.fetcher ?? ((...args) => globalThis.fetch(...args))
  }

  configureAuth(handlers?: AuthHandlers): void {
    this.authHandlers = handlers
    this.refreshPromise = null
  }

  get<TResponse>(
    path: string,
    options?: Omit<RequestOptions, 'body'>,
  ): Promise<TResponse> {
    return this.request<TResponse>('GET', path, options)
  }

  post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'body'>,
  ): Promise<TResponse> {
    return this.request<TResponse, TBody>('POST', path, { ...options, body })
  }

  patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'body'>,
  ): Promise<TResponse> {
    return this.request<TResponse, TBody>('PATCH', path, { ...options, body })
  }

  delete<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'body'>,
  ): Promise<TResponse> {
    return this.request<TResponse, TBody>('DELETE', path, { ...options, body })
  }

  async request<TResponse, TBody = unknown>(
    method: HttpMethod,
    path: string,
    options: RequestOptions<TBody> = {},
  ): Promise<TResponse> {
    const scope = getAuthorization()
    const identityOnly = options.identityOnly === true
    const revision = identityOnly ? scope.identity : scope.revision
    const guarded = options.authenticated !== false && !options.sessionOperation
    if (guarded) assertAuthorization(revision, identityOnly)
    const guardSignal =
      guarded && !identityOnly
        ? contextSignal(options.signal)
        : { signal: options.signal, release: () => undefined }
    try {
      const result = await this.execute<TResponse, TBody>(
        method,
        path,
        { ...options, signal: guardSignal.signal },
        true,
        () => {
          if (guarded) assertAuthorization(revision, identityOnly)
        },
      )
      if (guarded) assertAuthorization(revision, identityOnly)
      return result
    } finally {
      guardSignal.release()
    }
  }

  private async execute<TResponse, TBody>(
    method: HttpMethod,
    path: string,
    options: RequestOptions<TBody>,
    allowAuthRetry: boolean,
    assertCurrent: () => void,
  ): Promise<TResponse> {
    const authenticated = options.authenticated !== false
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (authenticated) {
      const accessToken = this.authHandlers?.getAccessToken()
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const url = appendQuery(`${this.baseUrl}${normalizedPath}`, options.query)
    const init = toRequestInit(options)

    let response: Response
    try {
      response = await this.fetcher(url, {
        ...init,
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
    } catch (error: unknown) {
      if (isAbortError(error)) throw ApiError.aborted(error)
      throw ApiError.network(error)
    }

    if (
      response.status === 401 &&
      authenticated &&
      allowAuthRetry &&
      this.authHandlers?.refreshAccessToken
    ) {
      assertCurrent()
      const refreshedToken = await this.refreshAccessToken()
      if (refreshedToken) {
        assertCurrent()
        if (method === 'GET' || options.retryAfterRefresh) {
          return this.execute<TResponse, TBody>(
            method,
            path,
            options,
            false,
            assertCurrent,
          )
        }
        const message =
          'Sessão renovada. A operação não foi reenviada; revise e tente novamente.'
        announceAuthorizationNotice(message)
        throw new ApiError({ status: 401, code: 'UNAUTHORIZED', message })
      }
      assertCurrent()
      this.authHandlers.onSessionExpired?.()
      throw await ApiError.fromResponse(response)
    }

    if (!response.ok) {
      assertCurrent()
      if (response.status === 401 && authenticated && !allowAuthRetry) {
        this.authHandlers?.onSessionExpired?.()
      }
      const error = await ApiError.fromResponse(response)
      if (response.status === 403 && authenticated && !options.sessionOperation)
        this.authHandlers?.onForbidden?.()
      throw error
    }

    return this.parseResponse<TResponse>(response)
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.authHandlers?.refreshAccessToken) return null

    if (!this.refreshPromise) {
      this.refreshPromise = this.authHandlers.refreshAccessToken().finally(() => {
        this.refreshPromise = null
      })
    }

    return this.refreshPromise
  }

  private async parseResponse<TResponse>(response: Response): Promise<TResponse> {
    if (response.status === 204) return undefined as TResponse

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      return (await response.json()) as TResponse
    }

    return (await response.text()) as TResponse
  }
}

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || '/api'

export const httpClient = new HttpClient({ baseUrl: configuredApiUrl })
