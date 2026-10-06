import { z } from 'zod';

export const NetworkProfileSchema = z.enum([
  'general',
  'tiktok',
  'meta',
  'google',
  'x',
  'organic',
  'custom',
]);
export type NetworkProfile = z.infer<typeof NetworkProfileSchema>;

export const NetworkEvidenceStatusSchema = z.enum([
  'verified_bot',
  'network_association',
  'unknown',
  'unavailable',
]);
export type NetworkEvidenceStatus = z.infer<typeof NetworkEvidenceStatusSchema>;

export const NetworkEvidenceSchema = z.object({
  status: NetworkEvidenceStatusSchema,
  asn: z.number().int().positive().nullable(),
  organization: z.string().nullable(),
  botIdentity: z.string().nullable(),
  stale: z.boolean(),
  sourceId: z.string().nullable(),
  sourceVersion: z.string().nullable(),
  fetchedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  verificationMethod: z.string().nullable(),
  verifiedAt: z.string().datetime().nullable(),
});
export type NetworkEvidence = z.infer<typeof NetworkEvidenceSchema>;
