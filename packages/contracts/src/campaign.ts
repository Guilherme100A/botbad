import { z } from 'zod';
import { NetworkProfileSchema } from './network.js';

export const CampaignStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'archived',
]);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

const httpsUrl = z.string().url().startsWith('https://');

export const DestinationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  url: httpsUrl,
  label: z.string().min(1).max(255),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Destination = z.infer<typeof DestinationSchema>;

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(128),
  primaryDestinationId: z.string().uuid(),
  alternativeDestinationId: z.string().uuid(),
  networkProfile: NetworkProfileSchema.default('general'),
  status: CampaignStatusSchema,
  policyVersion: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine(
  (c) => c.primaryDestinationId !== c.alternativeDestinationId,
  { message: 'Primary and alternative destinations must be distinct', path: ['alternativeDestinationId'] },
);
export type Campaign = z.infer<typeof CampaignSchema>;

export const CreateCampaignInputSchema = z.object({
  name: z.string().min(1).max(255),
  primaryDestinationId: z.string().uuid(),
  alternativeDestinationId: z.string().uuid(),
  networkProfile: NetworkProfileSchema.optional(),
}).refine(
  (c) => c.primaryDestinationId !== c.alternativeDestinationId,
  { message: 'Primary and alternative destinations must be distinct', path: ['alternativeDestinationId'] },
);
export type CreateCampaignInput = z.infer<typeof CreateCampaignInputSchema>;

export const CreateDestinationInputSchema = z.object({
  url: httpsUrl,
  label: z.string().min(1).max(255),
});
export type CreateDestinationInput = z.infer<typeof CreateDestinationInputSchema>;
