import { AuthUser } from '../types';

const base = '/api';
let tokenResolver: (() => Promise<string | null>) | null = null;

export function setTokenResolver(resolver: () => Promise<string | null>) {
  tokenResolver = resolver;
}

// Keeping this for backwards compatibility if needed during migration, though we won't use it directly
export function setAccessToken(token: string | null) {
  if (!tokenResolver) {
    tokenResolver = async () => token;
  }
}

export async function api<T = any>(path: string, opts: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (tokenResolver) {
    const token = await tokenResolver();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let r = await fetch(base + path, { ...opts, headers, credentials: 'include', signal: controller.signal });
    if (!r.ok) {
      const e = await r.json().catch(() => ({ error: { message: r.statusText } }));
      const err: any = new Error(e.error?.message || 'Request failed');
      err.code = e.error?.code;
      err.status = r.status;
      err.organizations = e.error?.organizations;
      throw err;
    }
    return r.status === 204 ? (undefined as T) : r.json();
  } finally {
    clearTimeout(timeout);
  }
}
