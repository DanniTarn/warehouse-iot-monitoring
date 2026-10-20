const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(
  /\/+$/,
  '',
)

export class UnauthorizedError extends Error {
  constructor(message = 'Phiên đăng nhập đã hết hạn.') {
    super(message)
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Bạn không có quyền thực hiện thao tác này.') {
    super(message)
  }
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface RequestOptions {
  token?: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

function messageOf(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return undefined
}

export async function request<T>(
  path: string,
  { token, method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error('Không kết nối được máy chủ.')
  }
  const payload: unknown = await response.json().catch(() => null)
  if (response.status === 401) throw new UnauthorizedError(messageOf(payload))
  if (response.status === 403) throw new ForbiddenError(messageOf(payload))
  if (!response.ok) {
    throw new HttpError(response.status, messageOf(payload) ?? 'Máy chủ trả về lỗi.')
  }
  return payload as T
}
