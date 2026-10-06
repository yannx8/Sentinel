import type { Request, Response } from 'express';
import { env, isProduction } from '../env';

export const SESSION_COOKIE = 'sentinel_session';

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction || env.SESSION_COOKIE_SAMESITE === 'none',
    sameSite: env.SESSION_COOKIE_SAMESITE,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction || env.SESSION_COOKIE_SAMESITE === 'none',
    sameSite: env.SESSION_COOKIE_SAMESITE,
    path: '/',
  });
}
