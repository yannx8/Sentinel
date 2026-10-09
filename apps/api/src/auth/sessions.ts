import type { Session, User } from '../generated/prisma/client';
import type { Request } from 'express';
import { hashToken, newToken } from '../lib/crypto';
import { prisma } from '../lib/prisma';
import { readCookie, SESSION_COOKIE } from '../http/cookies';

const ABSOLUTE_LIFETIME_MS = 30 * 24 * 3600 * 1000;
const IDLE_TIMEOUT_MS = 14 * 24 * 3600 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type AuthState = { user: User; session: Session };

export async function createSession(userId: string, req: Request): Promise<{ token: string; session: Session }> {
  const token = newToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
      ip: req.ip ?? null,
      expiresAt: new Date(Date.now() + ABSOLUTE_LIFETIME_MS),
    },
  });
  return { token, session };
}

function tokenFrom(req: Request): string | undefined {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return readCookie(req, SESSION_COOKIE);
}

/** Resolves the caller from the session cookie or bearer token. Null when absent, expired or idle. */
export async function resolveSession(req: Request): Promise<AuthState | null> {
  const token = tokenFrom(req);
  if (!token || token.length > 200) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.lastSeenAt.getTime() + IDLE_TIMEOUT_MS <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } });
  }
  const { user, ...rest } = session;
  return { user, session: rest };
}

export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}
