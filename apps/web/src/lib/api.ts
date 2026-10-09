import type { ApiErrorBody, ErrorCode, Page } from '@sentinel/shared';

const BASE = `${import.meta.env.VITE_API_URL ?? '/api'}/v1`;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.code = body.code;
    this.status = status;
    this.details = body.details;
    this.requestId = body.requestId;
  }

  /** Field errors from VALIDATION_FAILED or CONFLICT, keyed by field path. */
  get fields(): Record<string, string[]> {
    const details = this.details as { fields?: Record<string, string[]> } | undefined;
    return details?.fields ?? {};
  }
}

let activeOrgId: string | null = null;
const listeners = new Set<(error: ApiError) => void>();

/** Every tenant request carries the active organization (X-Org-Id). */
export const getActiveOrg = () => activeOrgId;

export function setActiveOrgHeader(orgId: string | null) {
  activeOrgId = orgId;
}

/** Called for errors that change what the whole app should show (signed out, suspended). */
export function onGlobalApiError(listener: (error: ApiError) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Overrides the active organization for this call. */
  orgId?: string;
};

export function apiUrl(path: string, query?: Options['query']) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${BASE}${path}${search ? `?${search}` : ''}`;
}

/** Absolute URL for a same-origin API path such as an attachment url. */
export function resourceUrl(path: string) {
  return `${import.meta.env.VITE_API_URL ?? '/api'}${path}`;
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const orgId = options.orgId ?? activeOrgId;
  if (orgId) headers['X-Org-Id'] = orgId;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) body = options.body;
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(
      { code: 'INTERNAL', message: 'You appear to be offline. Check your connection and try again.' },
      0,
    );
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorBody = (payload as { error?: ApiErrorBody } | null)?.error ?? {
      code: 'INTERNAL' as const,
      message: 'Something went wrong. Try again.',
    };
    const error = new ApiError(errorBody, response.status);
    listeners.forEach((listener) => listener(error));
    throw error;
  }
  return payload as T;
}

export const api = {
  /** Returns the `data` member of the response. */
  async get<T>(path: string, options?: Omit<Options, 'method' | 'body'>): Promise<T> {
    return (await request<{ data: T }>(path, options)).data;
  },
  page<T>(path: string, options?: Omit<Options, 'method' | 'body'>): Promise<Page<T>> {
    return request<Page<T>>(path, options);
  },
  async post<T = void>(path: string, body?: unknown, options?: Omit<Options, 'method' | 'body'>): Promise<T> {
    const result = await request<{ data: T } | undefined>(path, { ...options, method: 'POST', body: body ?? {} });
    return result?.data as T;
  },
  async patch<T>(path: string, body: unknown, options?: Omit<Options, 'method' | 'body'>): Promise<T> {
    return (await request<{ data: T }>(path, { ...options, method: 'PATCH', body })).data;
  },
  async delete(path: string, options?: Omit<Options, 'method' | 'body'>): Promise<void> {
    await request<void>(path, { ...options, method: 'DELETE' });
  },
};

export function newIdempotencyKey() {
  return crypto.randomUUID();
}
