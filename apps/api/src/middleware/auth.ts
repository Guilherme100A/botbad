import { createMiddleware } from 'hono/factory';
import type { Role } from '@botbad/contracts';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  role: Role;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthPayload;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid token' }, 401);
  }

  const token = header.slice(7);
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString(),
    ) as AuthPayload;

    if (!payload.userId || !payload.tenantId || !payload.role) {
      return c.json({ code: 'UNAUTHORIZED', message: 'Invalid token payload' }, 401);
    }

    c.set('auth', payload);
    await next();
  } catch {
    return c.json({ code: 'UNAUTHORIZED', message: 'Malformed token' }, 401);
  }
});

export function requireRole(...allowed: Role[]) {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth');
    if (!allowed.includes(auth.role)) {
      return c.json({ code: 'FORBIDDEN', message: 'Insufficient permissions' }, 403);
    }
    await next();
  });
}

export function createMockJwt(payload: AuthPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.mock`;
}
