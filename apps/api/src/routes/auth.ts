import { Hono } from 'hono';
import { z } from 'zod';
import { RoleSchema } from '@botbad/contracts';
import { createMockJwt } from '../middleware/auth.js';

const loginInput = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  role: RoleSchema,
});

const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid login input', details: parsed.error.flatten() },
      400,
    );
  }

  const token = createMockJwt(parsed.data);
  return c.json({ token });
});

export { authRoutes };
