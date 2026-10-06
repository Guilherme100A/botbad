import { z } from 'zod';

export const RoleSchema = z.enum(['owner', 'operator', 'viewer']);
export type Role = z.infer<typeof RoleSchema>;

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  createdAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const MembershipSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  role: RoleSchema,
  createdAt: z.string().datetime(),
});
export type Membership = z.infer<typeof MembershipSchema>;
