import { createHmac, timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { Role } from '@botbad/contracts';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  role: Role;
  exp?: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthPayload;
  }
}

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production';

function hmacSign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

function verifyJwt(token: string, secret: string): AuthPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = hmacSign(signingInput, secret);

  const sigBuffer = Buffer.from(signatureB64!, 'base64url');
  const expectedBuffer = Buffer.from(expectedSig, 'base64url');

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid signature');
  }

  const header = JSON.parse(Buffer.from(headerB64!, 'base64url').toString());
  if (header.alg !== 'HS256') throw new Error('Unsupported algorithm');

  const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString()) as AuthPayload;

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid token' }, 401);
  }

  const token = header.slice(7);
  try {
    const payload = verifyJwt(token, JWT_SECRET);

    if (!payload.userId || !payload.tenantId || !payload.role) {
      return c.json({ code: 'UNAUTHORIZED', message: 'Invalid token payload' }, 401);
    }

    c.set('auth', payload);
    await next();
  } catch {
    return c.json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' }, 401);
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

export function signJwt(payload: AuthPayload, secret: string = JWT_SECRET): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}
