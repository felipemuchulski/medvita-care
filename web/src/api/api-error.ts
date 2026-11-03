export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'REQUEST_ABORTED'
  | 'UNKNOWN_ERROR'

const statusMessages: Record<number, string> = {
  400: 'Verifique os dados informados e tente novamente.',
  401: 'Sua sessão expirou ou não é válida. Entre novamente.',
  403: 'Você não possui permissão para realizar esta ação.',
  404: 'O recurso solicitado não foi encontrado.',
  409: 'A operação não pôde ser concluída por um conflito de dados.',
  422: 'Alguns dados informados não são válidos.',
  500: 'O servidor encontrou um erro. Tente novamente mais tarde.',
  503: 'O serviço está temporariamente indisponível.',
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 400) return 'BAD_REQUEST'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 422) return 'VALIDATION_ERROR'
  if (status >= 500) return 'SERVER_ERROR'
  return 'UNKNOWN_ERROR'
}

function safeMessages(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []

  const message = Reflect.get(payload, 'message')
  const values = Array.isArray(message) ? message : [message]

  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 10)
}

async function readErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return undefined

  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly messages: string[]
  readonly cause?: unknown

  constructor(options: {
    status: number
    code: ApiErrorCode
    message: string
    messages?: string[]
    cause?: unknown
  }) {
    super(options.message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.messages = options.messages ?? [options.message]
    this.cause = options.cause
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const payload = await readErrorPayload(response)
    const backendMessages = response.status < 500 ? safeMessages(payload) : []
    const fallback =
      statusMessages[response.status] ??
      (response.status >= 500
        ? statusMessages[500]
        : 'Não foi possível concluir a solicitação.')
    const messages = backendMessages.length > 0 ? backendMessages : [fallback]

    return new ApiError({
      status: response.status,
      code: codeForStatus(response.status),
      message: messages[0],
      messages,
    })
  }

  static network(cause: unknown): ApiError {
    return new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
      cause,
    })
  }

  static aborted(cause: unknown): ApiError {
    return new ApiError({
      status: 0,
      code: 'REQUEST_ABORTED',
      message: 'A solicitação foi cancelada.',
      cause,
    })
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
